import { drain } from "../internal/drain.js";
import { operator } from "../internal/operator.js";
import { watchFirst } from "../internal/watch-first.js";
import { createStream } from "../sources/create-stream.js";
import type { Observable, Operator } from "../types.js";

/**
 * Starts collecting values into a new array each time `openings` emits, and
 * emits that array when `closingSelector(openValue)` emits. Arrays still open
 * when the source completes are emitted then.
 *
 * @example
 * logs.pipeThrough(bufferToggle(fromEvent(start, "click"), () => fromEvent(stop, "click")));
 */
export function bufferToggle<T, O>(
  openings: Observable<O>,
  closingSelector: (openValue: O) => Observable<unknown>,
): Operator<T, T[]> {
  return operator((source) =>
    createStream<T[]>(async (subscriber) => {
      const buffers: T[][] = [];
      const fail = (error: unknown): void => {
        subscriber.error(error);
      };
      drain(
        openings,
        (openValue) => {
          const buffered: T[] = [];
          buffers.push(buffered);
          watchFirst(closingSelector(openValue), subscriber.signal).fired.then((fired) => {
            const index = buffers.indexOf(buffered);
            if (!fired || index < 0) return;
            buffers.splice(index, 1);
            subscriber.next(buffered);
          }, fail);
        },
        subscriber.signal,
      ).catch(fail);
      await drain(
        source,
        (value) => {
          for (const buffered of buffers) buffered.push(value);
        },
        subscriber.signal,
      );
      for (const buffered of buffers.splice(0)) subscriber.next(buffered);
      subscriber.complete();
    }),
  );
}
