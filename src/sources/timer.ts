import type { Observable } from "../types.js";
import { createStream } from "./create-stream.js";

/**
 * Emits `0` once after `ms` milliseconds, then completes.
 *
 * @example
 * timer(500).pipeThrough(map(() => "done"));
 */
export function timer(ms: number): Observable<0> {
  return createStream<0>((subscriber) => {
    const id = setTimeout(() => {
      subscriber.next(0);
      subscriber.complete();
    }, ms);
    return () => {
      clearTimeout(id);
    };
  });
}
