import { concat } from "../combiners/concat.js";
import { operator } from "../internal/operator.js";
import type { Observable, Operator } from "../types.js";

/**
 * Emits the source's values, then the values of each of `others` in turn.
 * See `concat()`.
 *
 * @example
 * of(1, 2).pipeThrough(concatWith(of(3))); // 1, 2, 3
 */
export function concatWith<T, U extends readonly unknown[]>(
  ...others: { [K in keyof U]: Observable<U[K]> }
): Operator<T, T | U[number]> {
  return operator((source) => concat<[T, ...U]>(source, ...others));
}
