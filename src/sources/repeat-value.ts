import type { Observable } from "../types.js";
import { generate } from "./generate.js";

/**
 * Emits `value` forever, once per read. Pair it with `take()`.
 *
 * @example
 * repeatValue("x").pipeThrough(take(3)); // "x", "x", "x"
 */
export function repeatValue<T>(value: T): Observable<T> {
  return generate({ initialState: value, iterate: (same) => same });
}
