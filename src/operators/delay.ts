import { drain } from "../internal/drain.js";
import { operator } from "../internal/operator.js";
import { createStream } from "../sources/create-stream.js";
import type { Operator } from "../types.js";

/**
 * Shifts every value, and completion, later by `ms` milliseconds while
 * keeping the gaps between values.
 *
 * @example
 * of("a", "b").pipeThrough(delay(1000));
 */
export function delay<T>(ms: number): Operator<T> {
  return operator((source) =>
    createStream<T>(async (subscriber) => {
      const timers = new Set<ReturnType<typeof setTimeout>>();
      const later = (f: () => void): void => {
        const id = setTimeout(() => {
          timers.delete(id);
          f();
        }, ms);
        timers.add(id);
      };
      subscriber.signal.addEventListener(
        "abort",
        () => {
          for (const id of timers) clearTimeout(id);
        },
        { once: true },
      );
      await drain(
        source,
        (value) => {
          later(() => {
            subscriber.next(value);
          });
        },
        subscriber.signal,
      );
      later(() => {
        subscriber.complete();
      });
    }),
  );
}
