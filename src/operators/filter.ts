import { createTransform } from "../internal/transform.js";
import type { Operator } from "../types.js";

/**
 * Emits only the values for which `predicate(value, index)` is true.
 *
 * @example
 * of(1, 2, 3).pipeThrough(filter((n) => n % 2 === 1)); // 1, 3
 */
export function filter<In, Out extends In>(
  predicate: (value: In, index: number) => value is Out,
): Operator<In, Out>;
export function filter<T>(predicate: (value: T, index: number) => boolean): Operator<T>;
export function filter<T>(predicate: (value: T, index: number) => boolean): Operator<T> {
  let index = 0;
  return createTransform<T, T>({
    transform(value, controller) {
      const passes = predicate(value, index++);
      if (passes) controller.enqueue(value);
    },
  });
}
