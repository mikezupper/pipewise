import { drain } from "../internal/drain.js";
import { operator } from "../internal/operator.js";
import { createStream } from "../sources/create-stream.js";
import type { Operator } from "../types.js";

interface Pending<T> {
  readonly values: T[];
  timer?: ReturnType<typeof setTimeout>;
}

/**
 * Emits arrays of the values collected over `bufferTimeSpan` ms. By default a
 * new array starts when the previous one is emitted; with
 * `bufferCreationInterval`, a new array starts every that many ms, so arrays
 * can overlap. An array that reaches `maxBufferSize` is emitted early. Open
 * arrays are emitted when the source completes.
 *
 * @example
 * events.pipeThrough(bufferTime(1000)); // one array per second
 */
export function bufferTime<T>(
  bufferTimeSpan: number,
  bufferCreationInterval: number | null = null,
  maxBufferSize: number = Infinity,
): Operator<T, T[]> {
  return operator((source) =>
    createStream<T[]>(async (subscriber) => {
      const open: Pending<T>[] = [];
      const restartOnEmit = bufferCreationInterval === null || bufferCreationInterval < 0;
      let creator: ReturnType<typeof setInterval> | undefined;
      const emit = (pending: Pending<T>): void => {
        clearTimeout(pending.timer);
        open.splice(open.indexOf(pending), 1);
        subscriber.next(pending.values);
        if (restartOnEmit) start();
      };
      const start = (): void => {
        if (subscriber.closed) return;
        const pending: Pending<T> = { values: [] };
        open.push(pending);
        pending.timer = setTimeout(() => {
          emit(pending);
        }, bufferTimeSpan);
      };
      const stopTimers = (): void => {
        clearInterval(creator);
        for (const pending of open) clearTimeout(pending.timer);
      };
      subscriber.signal.addEventListener("abort", stopTimers, { once: true });
      if (!restartOnEmit) creator = setInterval(start, bufferCreationInterval);
      start();
      await drain(
        source,
        (value) => {
          for (const pending of open.slice()) {
            pending.values.push(value);
            if (pending.values.length >= maxBufferSize) emit(pending);
          }
        },
        subscriber.signal,
      );
      stopTimers();
      for (const pending of open.splice(0)) subscriber.next(pending.values);
      subscriber.complete();
    }),
  );
}
