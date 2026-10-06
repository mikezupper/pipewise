import { race } from "../combiners/race.js";
import { operator } from "../internal/operator.js";
import type { Observable, Operator } from "../types.js";

/**
 * Mirrors whichever of the source and `others` acts first, cancelling the
 * rest. See `race()`.
 *
 * @example
 * primary.pipeThrough(raceWith(fallbackAfterDelay));
 */
export function raceWith<T, U extends readonly unknown[]>(
  ...others: { [K in keyof U]: Observable<U[K]> }
): Operator<T, T | U[number]> {
  return operator((source) => race<[T, ...U]>(source, ...others));
}
