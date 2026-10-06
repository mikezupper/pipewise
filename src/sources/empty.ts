import type { Observable } from "../types.js";

/**
 * Completes immediately without emitting. RxJS's `EMPTY` constant is a
 * function here because a stream can be read only once.
 *
 * @example
 * empty().pipeThrough(defaultIfEmpty("nothing")); // "nothing"
 */
export function empty<T = never>(): Observable<T> {
  return new ReadableStream<T>({
    start(controller) {
      controller.close();
    },
  });
}
