import type { Observable, QueueOptions } from "../types.js";
import { createStream } from "./create-stream.js";

/**
 * Emits 0, 1, 2, … every `ms` milliseconds until cancelled.
 * Ticks are queued if nobody reads them; bound the queue with `queue`, or
 * pair with `take()` or `takeUntil()`.
 *
 * @example
 * interval(1000).pipeThrough(take(3)); // 0, 1, 2
 */
export function interval(ms: number, queue?: QueueOptions): Observable<number> {
  return createStream<number>((subscriber) => {
    let i = 0;
    const id = setInterval(() => {
      subscriber.next(i++);
    }, ms);
    return () => {
      clearInterval(id);
    };
  }, queue);
}
