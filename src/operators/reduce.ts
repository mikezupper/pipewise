import { createTransform } from "../internal/transform.js";
import type { Operator } from "../types.js";
import type { Accumulator } from "./scan.js";

/**
 * Folds every value into an accumulator and emits the result when the source
 * completes. Without `seed`, the first value seeds the accumulator. An empty
 * source emits `seed` if given, otherwise nothing.
 *
 * @example
 * of(1, 2, 3).pipeThrough(reduce((sum, n) => sum + n, 0)); // 6
 */
export function reduce<T>(accumulator: Accumulator<T, T>): Operator<T>;
export function reduce<T, Acc>(accumulator: Accumulator<Acc, T>, seed: Acc): Operator<T, Acc>;
export function reduce<T, Acc>(
  accumulator: Accumulator<Acc | T, T>,
  ...seed: [] | [Acc]
): Operator<T, Acc | T> {
  let hasState = seed.length > 0;
  let state: Acc | T | undefined = seed[0];
  let index = 0;
  return createTransform<T, Acc | T>({
    transform(chunk) {
      const i = index++;
      state = hasState ? accumulator(state as Acc | T, chunk, i) : chunk;
      hasState = true;
    },
    flush(controller) {
      if (hasState) controller.enqueue(state);
    },
  });
}
