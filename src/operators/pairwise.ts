import { createTransform } from "../internal/transform.js";
import type { Operator } from "../types.js";

/**
 * Emits `[previous, current]` for each value after the first.
 *
 * @example
 * of(1, 2, 3).pipeThrough(pairwise()); // [1, 2], [2, 3]
 */
export function pairwise<T>(): Operator<T, [T, T]> {
  let hasPrevious = false;
  let previous: T | undefined;
  return createTransform<T, [T, T]>({
    transform(chunk, controller) {
      if (hasPrevious) controller.enqueue([previous as T, chunk]);
      hasPrevious = true;
      previous = chunk;
    },
  });
}
