import { createTransform } from "../internal/transform.js";
import type { Operator } from "../types.js";

/**
 * Drops a value if it equals the previous one. Equality is `===` unless you
 * pass `comparator`.
 *
 * @example
 * of(1, 1, 2, 1).pipeThrough(distinctUntilChanged()); // 1, 2, 1
 */
export function distinctUntilChanged<T>(
  comparator: (previous: T, current: T) => boolean = (a, b) => a === b,
): Operator<T> {
  let hasPrevious = false;
  let previous: T | undefined;
  return createTransform<T, T>({
    transform(chunk, controller) {
      if (hasPrevious && comparator(previous as T, chunk)) return;
      hasPrevious = true;
      previous = chunk;
      controller.enqueue(chunk);
    },
  });
}
