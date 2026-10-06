import type { Observable, Operator } from "../types.js";
import { map } from "./map.js";
import { mergeMap } from "./merge-map.js";
import { take } from "./take.js";

/**
 * Delays each value until `durationSelector(value, index)` emits. A value
 * whose duration stream completes without emitting is dropped, as in RxJS 7.
 *
 * @example
 * jobs.pipeThrough(delayWhen((job) => timer(job.retryAfter)));
 */
export function delayWhen<T>(
  durationSelector: (value: T, index: number) => Observable<unknown>,
): Operator<T> {
  return mergeMap((value: T, index) =>
    durationSelector(value, index)
      .pipeThrough(take(1))
      .pipeThrough(map(() => value)),
  );
}
