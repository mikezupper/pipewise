import { createTransform } from "../internal/transform.js";
import type { Operator } from "../types.js";

/**
 * Emits the first `count` values, then completes and cancels the source.
 *
 * @example
 * interval(10).pipeThrough(take(3)); // 0, 1, 2
 */
export function take<T>(count: number): Operator<T> {
  let taken = 0;
  return createTransform<T, T>({
    start(controller) {
      // Nothing to take: finish at once rather than waiting for a first value.
      if (!(count > 0)) controller.terminate();
    },
    transform(value, controller) {
      taken += 1;
      controller.enqueue(value);
      if (taken >= count) controller.terminate();
    },
  });
}
