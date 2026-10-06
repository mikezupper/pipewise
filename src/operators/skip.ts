import { createTransform } from "../internal/transform.js";
import type { Operator } from "../types.js";

/**
 * Drops the first `count` values and emits the rest.
 *
 * @example
 * of(1, 2, 3).pipeThrough(skip(1)); // 2, 3
 */
export function skip<T>(count: number): Operator<T> {
  let remaining = count;
  return createTransform<T, T>({
    transform(chunk, controller) {
      if (remaining > 0) remaining--;
      else controller.enqueue(chunk);
    },
  });
}
