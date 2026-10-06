import { createTransform } from "../internal/transform.js";
import type { Operator } from "../types.js";

/**
 * Emits how many values satisfied `predicate` (or how many there were) when
 * the source completes.
 *
 * @example
 * of("a", "b", "c").pipeThrough(count()); // 3
 */
export function count<T>(predicate?: (value: T, index: number) => boolean): Operator<T, number> {
  let total = 0;
  let index = 0;
  return createTransform<T, number>({
    transform(chunk) {
      if (!predicate || predicate(chunk, index++)) total++;
    },
    flush(controller) {
      controller.enqueue(total);
    },
  });
}
