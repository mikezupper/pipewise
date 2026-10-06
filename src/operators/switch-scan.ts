import type { Observable, Operator } from "../types.js";
import { switchMap } from "./switch-map.js";
import { tap } from "./tap.js";

/**
 * Like `scan()`, but the accumulator returns a stream, and a new value
 * cancels the previous accumulator stream. Each emitted value becomes the new
 * accumulated state.
 *
 * @example
 * queries.pipeThrough(switchScan((results, q) => search(q, results), []));
 */
export function switchScan<T, R>(
  accumulator: (acc: R, value: T, index: number) => Observable<R>,
  seed: R,
): Operator<T, R> {
  let state = seed;
  return switchMap((value: T, index) =>
    accumulator(state, value, index).pipeThrough(
      tap((next: R) => {
        state = next;
      }),
    ),
  );
}
