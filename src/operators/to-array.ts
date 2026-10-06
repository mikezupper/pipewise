import { createTransform } from "../internal/transform.js";
import type { Operator } from "../types.js";

/**
 * Emits one array of every value when the source completes.
 *
 * @example
 * of(1, 2).pipeThrough(toArray()); // [1, 2]
 */
export function toArray<T>(): Operator<T, T[]> {
  const values: T[] = [];
  return createTransform<T, T[]>({
    transform(chunk) {
      values.push(chunk);
    },
    flush(controller) {
      controller.enqueue(values);
    },
  });
}
