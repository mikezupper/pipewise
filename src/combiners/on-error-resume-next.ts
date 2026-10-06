import { cancelUnread } from "../internal/cancel-unread.js";
import { drain } from "../internal/drain.js";
import { createStream } from "../sources/create-stream.js";
import type { Observable } from "../types.js";

/**
 * Emits every value of each source in turn, moving to the next source when
 * one completes or errors. Errors are dropped; the output always completes.
 *
 * @example
 * onErrorResumeNext(fromAsyncFunction(primary), fromAsyncFunction(backup));
 */
export function onErrorResumeNext<T extends readonly unknown[]>(
  ...sources: { [K in keyof T]: Observable<T[K]> }
): Observable<T[number]> {
  return createStream<T[number]>(async (subscriber) => {
    subscriber.signal.addEventListener(
      "abort",
      () => {
        cancelUnread(sources, subscriber.signal.reason);
      },
      { once: true },
    );
    for (const source of sources) {
      if (subscriber.closed) return;
      try {
        await drain(
          source,
          (value) => {
            subscriber.next(value);
          },
          subscriber.signal,
          () => subscriber.ready(),
        );
      } catch {
        // Errors move on to the next source by design.
      }
    }
    subscriber.complete();
  });
}
