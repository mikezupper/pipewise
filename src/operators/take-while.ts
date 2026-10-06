import { createTransform } from "../internal/transform.js";
import type { Operator } from "../types.js";

/**
 * Emits values while `predicate(value, index)` holds, then completes and
 * cancels the source. With `inclusive`, the first failing value is emitted too.
 *
 * @example
 * of(1, 2, 3, 1).pipeThrough(takeWhile((n) => n < 3)); // 1, 2
 */
export function takeWhile<T>(
  predicate: (value: T, index: number) => boolean,
  inclusive = false,
): Operator<T> {
  let index = 0;
  return createTransform<T, T>({
    transform(value, controller) {
      const keep = predicate(value, index++);
      if (keep || inclusive) controller.enqueue(value);
      if (!keep) controller.terminate();
    },
  });
}
