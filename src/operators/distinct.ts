import { createTransform } from "../internal/transform.js";
import { drain } from "../internal/drain.js";
import { operator } from "../internal/operator.js";
import { createStream } from "../sources/create-stream.js";
import type { Observable, Operator } from "../types.js";

/**
 * Emits each value only the first time it is seen. `keySelector` picks what
 * to compare. Keys are kept in a `Set`, which grows for the life of the stream
 * unless `flushes` emits; each emission clears it.
 *
 * @example
 * of(1, 2, 1, 3).pipeThrough(distinct()); // 1, 2, 3
 * events.pipeThrough(distinct((e) => e.id, interval(60_000)));
 */
export function distinct<T>(
  keySelector?: (value: T) => unknown,
  flushes?: Observable<unknown>,
): Operator<T> {
  const seen = new Set<unknown>();
  const isNew = (value: T): boolean => {
    const key = keySelector ? keySelector(value) : value;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  };
  if (!flushes) {
    return createTransform<T, T>({
      transform(chunk, controller) {
        if (isNew(chunk)) controller.enqueue(chunk);
      },
    });
  }
  return operator((source) =>
    createStream<T>(async (subscriber) => {
      drain(
        flushes,
        () => {
          seen.clear();
        },
        subscriber.signal,
      ).catch((error: unknown) => {
        subscriber.error(error);
      });
      await drain(
        source,
        (value) => {
          if (isNew(value)) subscriber.next(value);
        },
        subscriber.signal,
        () => subscriber.ready(),
      );
      subscriber.complete();
    }),
  );
}
