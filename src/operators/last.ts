import { createTransform } from "../internal/transform.js";
import { EmptyError } from "../errors.js";
import type { Operator } from "../types.js";

/**
 * Emits the last value that satisfies `predicate` (or the last value at all)
 * when the source completes. If there is none, emits `defaultValue` when one
 * is given, or errors with `EmptyError`.
 *
 * @example
 * of(1, 2, 3).pipeThrough(last()); // 3
 * of<number>().pipeThrough(last(null, 0)); // 0
 */
export function last<T, D = T>(
  predicate?: ((value: T, index: number) => boolean) | null,
  ...defaultValue: [] | [D]
): Operator<T, T | D> {
  let index = 0;
  let found = false;
  let latest: T | undefined;
  return createTransform<T, T | D>({
    transform(chunk) {
      if (predicate && !predicate(chunk, index++)) return;
      found = true;
      latest = chunk;
    },
    flush(controller) {
      if (found) controller.enqueue(latest);
      else if (defaultValue.length > 0) controller.enqueue(defaultValue[0]);
      else throw new EmptyError();
    },
  });
}
