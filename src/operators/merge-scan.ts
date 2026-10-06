import type { Observable, Operator } from "../types.js";
import { mergeMap } from "./merge-map.js";
import { tap } from "./tap.js";

/**
 * Like `scan()`, but the accumulator returns a stream. Its values are emitted
 * and each one becomes the new accumulated state. Up to `concurrent`
 * accumulator streams run at once.
 *
 * @example
 * pages.pipeThrough(mergeScan((all, page) => fetchMore(all, page), [], 1));
 */
export function mergeScan<T, R>(
  accumulator: (acc: R, value: T, index: number) => Observable<R>,
  seed: R,
  concurrent: number = Infinity,
): Operator<T, R> {
  let state = seed;
  return mergeMap(
    (value: T, index) =>
      accumulator(state, value, index).pipeThrough(
        tap((next: R) => {
          state = next;
        }),
      ),
    concurrent,
  );
}
