import type { Observable } from "../types.js";

/**
 * Never emits, errors, or completes. RxJS's `NEVER` constant is a function
 * here because a stream can be read only once.
 *
 * @example
 * race(never(), timer(100)); // 0 after 100 ms
 */
export function never<T = never>(): Observable<T> {
  return new ReadableStream<T>(undefined, { highWaterMark: 0 });
}
