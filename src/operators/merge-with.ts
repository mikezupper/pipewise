import { merge } from "../combiners/merge.js";
import { operator } from "../internal/operator.js";
import type { Observable, Operator } from "../types.js";

/**
 * Emits values from the source and from `others` as they arrive.
 * See `merge()`.
 *
 * @example
 * clicks.pipeThrough(mergeWith(keypresses));
 */
export function mergeWith<T, U extends readonly unknown[]>(
  ...others: { [K in keyof U]: Observable<U[K]> }
): Operator<T, T | U[number]> {
  return operator((source) => merge<[T, ...U]>(source, ...others));
}
