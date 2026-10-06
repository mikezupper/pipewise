import { drain } from "../internal/drain.js";
import { operator } from "../internal/operator.js";
import { createStream } from "../sources/create-stream.js";
import type { Observable, Operator } from "../types.js";

/**
 * Each time `notifier` emits, emits the most recent source value if a new one
 * arrived since the last sample. Completes when the source completes.
 *
 * @example
 * mousePosition.pipeThrough(sample(interval(100)));
 */
export function sample<T>(notifier: Observable<unknown>): Operator<T> {
  return operator((source) =>
    createStream<T>(async (subscriber) => {
      let hasValue = false;
      let latest: T | undefined;
      drain(
        notifier,
        () => {
          if (!hasValue) return;
          hasValue = false;
          subscriber.next(latest as T);
        },
        subscriber.signal,
      ).catch((error: unknown) => {
        subscriber.error(error);
      });
      await drain(
        source,
        (value) => {
          hasValue = true;
          latest = value;
        },
        subscriber.signal,
      );
      subscriber.complete();
    }),
  );
}
