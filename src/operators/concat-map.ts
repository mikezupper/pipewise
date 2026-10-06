import type { Observable, Operator } from "../types.js";
import { mergeMap } from "./merge-map.js";

/**
 * Maps each value to a stream and emits their values in order, one stream at
 * a time. The next value is not mapped until the previous stream completes.
 *
 * @example
 * jobs.pipeThrough(concatMap((job) => fromAsyncFunction(() => run(job))));
 */
export function concatMap<In, Out>(
  project: (value: In, index: number) => Observable<Out>,
): Operator<In, Out> {
  return mergeMap(project, 1);
}
