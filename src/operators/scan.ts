import { createTransform } from "../internal/transform.js";
import type { Operator } from "../types.js";

/** Accumulator for `scan()` and `reduce()`. */
export type Accumulator<Acc, T> = (acc: Acc, value: T, index: number) => Acc;

/**
 * Emits each intermediate result of folding values into an accumulator.
 * Without `seed`, the first value becomes the accumulator and is emitted as is.
 *
 * @example
 * of(1, 2, 3).pipeThrough(scan((sum, n) => sum + n, 0)); // 1, 3, 6
 * of(1, 2, 3).pipeThrough(scan((max, n) => Math.max(max, n))); // 1, 2, 3
 */
export function scan<T>(accumulator: Accumulator<T, T>): Operator<T>;
export function scan<T, Acc>(accumulator: Accumulator<Acc, T>, seed: Acc): Operator<T, Acc>;
export function scan<T, Acc>(
  accumulator: Accumulator<Acc | T, T>,
  ...seed: [] | [Acc]
): Operator<T, Acc | T> {
  let hasState = seed.length > 0;
  let state: Acc | T | undefined = seed[0];
  let index = 0;
  return createTransform<T, Acc | T>({
    transform(chunk, controller) {
      const i = index++;
      state = hasState ? accumulator(state as Acc | T, chunk, i) : chunk;
      hasState = true;
      controller.enqueue(state);
    },
  });
}
