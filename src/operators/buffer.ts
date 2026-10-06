import { drain } from "../internal/drain.js";
import { operator } from "../internal/operator.js";
import { createStream } from "../sources/create-stream.js";
import type { Observable, Operator } from "../types.js";

/**
 * Collects source values and emits them as an array each time `notifier`
 * emits, even if the array is empty. When the source completes, the final
 * array is emitted and the output completes. A notifier that completes has
 * no effect.
 *
 * @example
 * keystrokes.pipeThrough(buffer(interval(1000))); // keystrokes per second
 */
export function buffer<T>(notifier: Observable<unknown>): Operator<T, T[]> {
  return operator((source) =>
    createStream<T[]>(async (subscriber) => {
      let buffered: T[] = [];
      drain(
        notifier,
        () => {
          const out = buffered;
          buffered = [];
          subscriber.next(out);
        },
        subscriber.signal,
      ).catch((error: unknown) => {
        subscriber.error(error);
      });
      await drain(
        source,
        (value) => {
          buffered.push(value);
        },
        subscriber.signal,
      );
      subscriber.next(buffered);
      subscriber.complete();
    }),
  );
}
