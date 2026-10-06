import type { Observable, Operator } from "../types.js";
import { mergeMap } from "./merge-map.js";

/**
 * Takes a stream of streams and emits values from all of them as they
 * arrive, reading at most `concurrent` inner streams at once.
 *
 * @example
 * urls.pipeThrough(map(download)).pipeThrough(mergeAll(4));
 */
export function mergeAll<T>(concurrent: number = Infinity): Operator<Observable<T>, T> {
  return mergeMap((inner: Observable<T>) => inner, concurrent);
}
