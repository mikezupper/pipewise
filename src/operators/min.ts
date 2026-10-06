import { ascending } from "../internal/ascending.js";
import type { Operator } from "../types.js";
import { reduce } from "./reduce.js";

/**
 * Emits the smallest value when the source completes, comparing with
 * `comparer` (default: `<` and `>`). An empty source emits nothing.
 *
 * @example
 * of(3, 9, 4).pipeThrough(min()); // 3
 */
export function min<T>(comparer: (a: T, b: T) => number = ascending): Operator<T> {
  return reduce<T>((a, b) => (comparer(a, b) < 0 ? a : b));
}
