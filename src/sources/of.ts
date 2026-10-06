import type { Observable } from "../types.js";
import { fromIterable } from "./from-iterable.js";

/**
 * Emits the given values in order, then completes.
 *
 * @example
 * of(1, 2, 3);
 */
export function of<T>(...values: T[]): Observable<T> {
  return fromIterable(values);
}
