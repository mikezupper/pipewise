import { cancelUnread } from "../internal/cancel-unread.js";
import { drain } from "../internal/drain.js";
import { createStream } from "../sources/create-stream.js";
import type { Observable } from "../types.js";

/**
 * Emits every value of the first source, then every value of the next, and
 * so on. Sources not yet reached are cancelled if the output ends early.
 *
 * @example
 * concat(of(1, 2), of(3)); // 1, 2, 3
 */
export function concat<T extends readonly unknown[]>(
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
      await drain(
        source,
        (value) => {
          subscriber.next(value);
        },
        subscriber.signal,
        () => subscriber.ready(),
      );
      if (subscriber.closed) return;
    }
    subscriber.complete();
  });
}
