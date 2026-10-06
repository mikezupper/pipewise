import { noop } from "./noop.js";
import type { Observable, Operator } from "../types.js";

/**
 * Turns a function from one stream to another into an `Operator` that
 * `pipeThrough()` accepts. Cancelling the output cancels the source, and a
 * source error reaches `build`'s stream, as long as `build` reads `source`
 * with `drain()` or `pipeThrough()`.
 *
 * The pipe into the operator holds at most one value that `build` has not
 * read yet, and a write completes only once that value has been read. An
 * upstream error waits for it, so a value emitted before the error is still
 * delivered (a native TransformStream would discard it). Pass `discard` to
 * release that value if the operator shuts down first; streams-of-streams
 * operators use it to cancel the inner stream.
 */
export function operator<In, Out>(
  build: (source: Observable<In>) => Observable<Out>,
  discard: (value: In) => void = noop,
): Operator<In, Out> {
  const { readable, writable } = deliveryPipe(discard);
  return { writable, readable: build(readable) };
}

interface InFlight<T> {
  readonly value: T;
  readonly resolve: () => void;
  readonly reject: (reason: unknown) => void;
}

/**
 * An identity pair like `new TransformStream()`, except each write resolves
 * when its value is read, and the value waiting to be read is visible, so it
 * can be discarded when the reader cancels.
 */
function deliveryPipe<T>(discard: (value: T) => void): Operator<T> {
  let output!: ReadableStreamDefaultController<T>;
  let input!: WritableStreamDefaultController;
  let inFlight: InFlight<T> | undefined;
  let demand = false;
  let cancelled = false;

  const deliver = (): void => {
    if (!inFlight || !demand) return;
    const { value, resolve } = inFlight;
    inFlight = undefined;
    demand = false;
    output.enqueue(value);
    resolve();
  };

  const readable = new ReadableStream<T>(
    {
      start(controller) {
        output = controller;
      },
      pull() {
        demand = true;
        deliver();
      },
      cancel(reason) {
        cancelled = true;
        const pending = inFlight;
        inFlight = undefined;
        if (pending) {
          discard(pending.value);
          pending.reject(reason);
        }
        input.error(reason);
      },
    },
    { highWaterMark: 0 },
  );

  const writable = new WritableStream<T>(
    {
      start(controller) {
        input = controller;
      },
      write(value) {
        if (cancelled) {
          discard(value);
          return;
        }
        return new Promise<void>((resolve, reject) => {
          inFlight = { value, resolve, reject };
          deliver();
        });
      },
      close() {
        if (!cancelled) output.close();
      },
      abort(reason) {
        if (!cancelled) output.error(reason);
      },
    },
    { highWaterMark: 1 },
  );

  return { readable, writable };
}
