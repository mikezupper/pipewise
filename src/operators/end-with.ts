import { concat } from "../combiners/concat.js";
import { operator } from "../internal/operator.js";
import { fromIterable } from "../sources/from-iterable.js";
import type { Operator } from "../types.js";

/**
 * Emits `values` after the source completes.
 *
 * @example
 * of(1, 2).pipeThrough(endWith(3)); // 1, 2, 3
 */
export function endWith<T>(...values: T[]): Operator<T> {
  return operator((source) => concat<[T, T]>(source, fromIterable(values)));
}
