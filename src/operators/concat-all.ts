import type { Observable, Operator } from "../types.js";
import { mergeAll } from "./merge-all.js";

/**
 * Takes a stream of streams and emits every value of each inner stream in
 * order, starting the next only after the previous completes.
 *
 * @example
 * of(of(1, 2), of(3)).pipeThrough(concatAll()); // 1, 2, 3
 */
export function concatAll<T>(): Operator<Observable<T>, T> {
  return mergeAll<T>(1);
}
