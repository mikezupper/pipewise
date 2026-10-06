import { combineLatest } from "../combiners/combine-latest.js";
import { operator } from "../internal/operator.js";
import type { Observable, Operator } from "../types.js";

/**
 * Combines the source with `others`, emitting the latest value of each.
 * See `combineLatest()`.
 *
 * @example
 * width.pipeThrough(combineLatestWith(height)); // [w, h] on every change
 */
export function combineLatestWith<T, U extends readonly unknown[]>(
  ...others: { [K in keyof U]: Observable<U[K]> }
): Operator<T, [T, ...U]> {
  return operator((source) => combineLatest<[T, ...U]>(source, ...others));
}
