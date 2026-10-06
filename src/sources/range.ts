import type { Observable } from "../types.js";
import { generate } from "./generate.js";

/**
 * Emits `count` consecutive integers starting at `start`.
 *
 * @example
 * range(1, 3); // 1, 2, 3
 */
export function range(start: number, count: number): Observable<number> {
  const end = start + count;
  return generate({ initialState: start, condition: (n) => n < end, iterate: (n) => n + 1 });
}
