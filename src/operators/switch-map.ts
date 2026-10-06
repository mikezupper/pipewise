import { createTransform } from "../internal/transform.js";
import type { Observable, Operator } from "../types.js";
import { switchAll } from "./switch-all.js";

/**
 * Maps each value to a stream and emits from the most recent one only.
 * See `switchAll()`.
 *
 * @example
 * queries.pipeThrough(switchMap((q) => fromAsyncFunction((signal) => search(q, signal))));
 */
export function switchMap<In, Out>(
  project: (value: In, index: number) => Observable<Out>,
): Operator<In, Out> {
  let index = 0;
  // Project in place, then let switchAll keep only the newest inner stream.
  const projection = createTransform<In, Observable<Out>>({
    transform(value, controller) {
      controller.enqueue(project(value, index++));
    },
  });
  return {
    writable: projection.writable,
    readable: projection.readable.pipeThrough(switchAll<Out>()),
  };
}
