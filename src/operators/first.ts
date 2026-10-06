import { createTransform } from "../internal/transform.js";
import { EmptyError } from "../errors.js";
import type { Operator } from "../types.js";

/**
 * Emits the first value that satisfies `predicate` (or the first value at
 * all), then completes and cancels the source. If the source completes first,
 * emits `defaultValue` when one is given, or errors with `EmptyError`.
 *
 * @example
 * of(1, 2, 3).pipeThrough(first((n) => n > 1)); // 2
 * of<number>().pipeThrough(first(null, 0)); // 0
 */
export function first<T, D = T>(
  predicate?: ((value: T, index: number) => boolean) | null,
  ...defaultValue: [] | [D]
): Operator<T, T | D> {
  let index = 0;
  return createTransform<T, T | D>({
    transform(chunk, controller) {
      if (predicate && !predicate(chunk, index++)) return;
      controller.enqueue(chunk);
      controller.terminate();
    },
    flush(controller) {
      if (defaultValue.length === 0) throw new EmptyError();
      controller.enqueue(defaultValue[0]);
    },
  });
}
