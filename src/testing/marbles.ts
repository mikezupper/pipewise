import { createStream } from "../sources/create-stream.js";
import type { Observable } from "../types.js";
import { deepEqual } from "./deep-equal.js";
import { parseMarbles, type MarbleEvent } from "./parse-marbles.js";
import { renderMarbles } from "./render-marbles.js";

/** Options for `marbles()`. */
export interface MarbleOptions {
  /** Advances fake time, e.g. `(ms) => vi.advanceTimersByTimeAsync(ms)`. */
  readonly advance: (ms: number) => Promise<unknown>;
  /** Milliseconds per frame. Defaults to `10`. */
  readonly frame?: number;
}

/** Marble helpers bound to a fake clock, returned by `marbles()`. */
export interface MarbleKit {
  /** A source that plays `diagram` from the moment it is first read. */
  cold<T>(diagram: string, values?: Readonly<Record<string, T>>, error?: unknown): Observable<T>;
  /** A source that plays `diagram` from the moment it is created; values emitted before anyone reads are missed. */
  hot<T>(diagram: string, values?: Readonly<Record<string, T>>, error?: unknown): Observable<T>;
  /** Reads `stream`, advancing time frame by frame, and throws if it does not match `diagram`. */
  expect<T>(
    stream: Observable<T>,
    diagram: string,
    values?: Readonly<Record<string, T>>,
    error?: unknown,
  ): Promise<void>;
}

/**
 * Marble testing for streams with any fake-timer library: you supply
 * `advance`. Frames are counted by the kit, so `Date` need not be faked.
 * See `parseMarbles()` for the diagram syntax.
 *
 * @example
 * const m = marbles({ advance: (ms) => vi.advanceTimersByTimeAsync(ms) });
 * await m.expect(m.cold("-a-b|", { a: 1, b: 2 }).pipeThrough(map((n) => n * 10)), "-a-b|", { a: 10, b: 20 });
 */
export function marbles(options: MarbleOptions): MarbleKit {
  const { advance, frame = 10 } = options;
  const play = <T>(events: MarbleEvent[], lazy: boolean): Observable<T> => {
    let started = false;
    let begin = (): void => undefined;
    const stream = createStream<T>(
      (subscriber) => {
        const timers: ReturnType<typeof setTimeout>[] = [];
        begin = () => {
          if (started) return;
          started = true;
          const emit = (event: MarbleEvent): void => {
            if (event.kind === "next") subscriber.next(event.value as T);
            else if (event.kind === "complete") subscriber.complete();
            else subscriber.error(event.error);
          };
          for (const event of events) {
            // A cold source's first frame plays the moment it is read, as in
            // RxJS; a timer would land one frame late when read mid-step.
            if (lazy && event.frame === 0) emit(event);
            else {
              timers.push(
                setTimeout(() => {
                  emit(event);
                }, event.frame * frame),
              );
            }
          }
        };
        if (!lazy) begin();
        return () => {
          for (const id of timers) clearTimeout(id);
        };
        // Hot sources drop values nobody is waiting for, as in RxJS.
      },
      lazy ? {} : { buffer: 0, overflow: "dropNewest" },
    );
    if (!lazy) return stream;
    const reader = stream.getReader();
    return new ReadableStream<T>(
      {
        async pull(controller) {
          begin();
          const result = await reader.read();
          if (result.done) controller.close();
          else controller.enqueue(result.value);
        },
        cancel: (reason) => reader.cancel(reason),
      },
      { highWaterMark: 0 },
    );
  };

  return {
    cold: (diagram, values, error) => play(parseMarbles(diagram, values, error), true),
    hot: (diagram, values, error) => play(parseMarbles(diagram, values, error), false),
    async expect(stream, diagram, values = {}, error) {
      const expected = parseMarbles(diagram, values, error);
      const actual: MarbleEvent[] = [];
      let current = 0;
      // Read through a function: the reading task changes it across awaits.
      const state = { ended: false };
      const isEnded = (): boolean => state.ended;
      const reader = stream.getReader();
      void (async () => {
        try {
          for (let r = await reader.read(); !r.done; r = await reader.read()) {
            actual.push({ frame: current, kind: "next", value: r.value });
          }
          actual.push({ frame: current, kind: "complete" });
        } catch (reason) {
          actual.push({ frame: current, kind: "error", error: reason });
        }
        state.ended = true;
      })();
      const lastFrame = Math.max(0, ...expected.map((e) => e.frame));
      await advance(0);
      while (!isEnded() || current < lastFrame) {
        if (current > lastFrame + 1000) break;
        // Stamp events that fire during this step with the frame they land on.
        current++;
        await advance(frame);
      }
      if (!isEnded()) await reader.cancel();
      const same =
        actual.length === expected.length &&
        actual.every((event, i) => {
          const other = expected[i];
          if (!other || other.frame !== event.frame || other.kind !== event.kind) return false;
          if (event.kind === "next" && other.kind === "next")
            return deepEqual(event.value, other.value);
          if (event.kind === "error" && other.kind === "error")
            return deepEqual(event.error, other.error);
          return true;
        });
      if (!same) {
        throw new Error(
          `Stream did not match marbles.\n  expected: ${renderMarbles(expected, values)}\n  actual:   ${renderMarbles(actual, values)}\n` +
            `  actual events: ${JSON.stringify(actual)}`,
        );
      }
    },
  };
}
