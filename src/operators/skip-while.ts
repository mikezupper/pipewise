import { createTransform } from "../internal/transform.js";
import type { Operator } from "../types.js";

/**
 * Drops values while `predicate` holds, then emits every value from the first
 * one that fails it.
 *
 * @example
 * of(1, 2, 3, 1).pipeThrough(skipWhile((n) => n < 3)); // 3, 1
 */
export function skipWhile<T>(predicate: (value: T, index: number) => boolean): Operator<T> {
  let skipping = true;
  let index = 0;
  return createTransform<T, T>({
    transform(chunk, controller) {
      if (skipping && predicate(chunk, index++)) return;
      skipping = false;
      controller.enqueue(chunk);
    },
  });
}
