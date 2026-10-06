import { createTransform } from "../internal/transform.js";
import type { Operator } from "../types.js";

/**
 * Emits `values` before anything from the source.
 *
 * @example
 * of(2, 3).pipeThrough(startWith(1)); // 1, 2, 3
 */
export function startWith<T>(...values: T[]): Operator<T> {
  return createTransform<T, T>({
    start(controller) {
      for (const value of values) controller.enqueue(value);
    },
  });
}
