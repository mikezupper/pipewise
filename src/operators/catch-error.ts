import { drain } from "../internal/drain.js";
import { operator } from "../internal/operator.js";
import { createStream } from "../sources/create-stream.js";
import type { Observable, Operator } from "../types.js";

/**
 * If the source errors, continues with the stream returned by
 * `handler(error)`. Values emitted before the error are kept.
 *
 * @example
 * prices.pipeThrough(catchError(() => of(cachedPrice)));
 */
export function catchError<T, R = T>(
  handler: (error: unknown) => Observable<R>,
): Operator<T, T | R> {
  return operator((source) =>
    createStream<T | R>(async (subscriber) => {
      const forward = (value: T | R): void => {
        subscriber.next(value);
      };
      const ready = (): Promise<void> => subscriber.ready();
      try {
        await drain(source, forward, subscriber.signal, ready);
      } catch (error) {
        if (subscriber.closed) return;
        await drain(handler(error), forward, subscriber.signal, ready);
      }
      subscriber.complete();
    }),
  );
}
