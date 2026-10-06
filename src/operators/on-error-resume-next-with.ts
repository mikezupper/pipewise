import { onErrorResumeNext } from "../combiners/on-error-resume-next.js";
import { operator } from "../internal/operator.js";
import type { Observable, Operator } from "../types.js";

/**
 * Emits the source's values, then each of `others` in turn, moving on when
 * one completes or errors. Errors are dropped. See `onErrorResumeNext()`.
 *
 * @example
 * risky.pipeThrough(onErrorResumeNextWith(of("fallback")));
 */
export function onErrorResumeNextWith<T, U extends readonly unknown[]>(
  ...others: { [K in keyof U]: Observable<U[K]> }
): Operator<T, T | U[number]> {
  return operator((source) => onErrorResumeNext<[T, ...U]>(source, ...others));
}
