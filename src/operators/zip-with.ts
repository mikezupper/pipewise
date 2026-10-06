import { zip } from "../combiners/zip.js";
import { operator } from "../internal/operator.js";
import type { Observable, Operator } from "../types.js";

/**
 * Pairs each source value with the value at the same position in `others`.
 * See `zip()`.
 *
 * @example
 * of("a", "b").pipeThrough(zipWith(of(1, 2))); // ["a", 1], ["b", 2]
 */
export function zipWith<T, U extends readonly unknown[]>(
  ...others: { [K in keyof U]: Observable<U[K]> }
): Operator<T, [T, ...U]> {
  return operator((source) => zip<[T, ...U]>(source, ...others));
}
