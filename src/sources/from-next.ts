import type { Observable, QueueOptions } from "../types.js";
import { createStream } from "./create-stream.js";
import { EOF, type NextFunc } from "./external.js";

/**
 * Creates a stream by handing its `next` function to `f`.
 * Shorthand for `external()` when the producer fits in one callback.
 *
 * @example
 * const ticks = fromNext<number>((next) => {
 *   next(1);
 *   next(2);
 *   next(EOF);
 * });
 */
export function fromNext<T>(
  f: (next: NextFunc<T>) => unknown,
  queue?: QueueOptions,
): Observable<T> {
  return createStream<T>((subscriber) => {
    f((value) => {
      if (value === EOF) subscriber.complete();
      else subscriber.next(value);
    });
  }, queue);
}
