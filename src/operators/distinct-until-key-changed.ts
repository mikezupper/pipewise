import type { Operator } from "../types.js";
import { distinctUntilChanged } from "./distinct-until-changed.js";

/**
 * Drops a value if its `key` property equals the previous value's. Equality
 * is `===` unless you pass `compare`.
 *
 * @example
 * users.pipeThrough(distinctUntilKeyChanged("id"));
 */
export function distinctUntilKeyChanged<T, K extends keyof T>(
  key: K,
  compare?: (previous: T[K], current: T[K]) => boolean,
): Operator<T> {
  return distinctUntilChanged<T>((a, b) => (compare ? compare(a[key], b[key]) : a[key] === b[key]));
}
