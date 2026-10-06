import { createTransform } from "../internal/transform.js";
import { isPromiseLike } from "../internal/is-promise-like.js";
import type { Operator } from "../types.js";

/**
 * Emits `project(value, index)` for each value. If `project` returns a
 * promise, its result is awaited before the next value is read.
 *
 * @example
 * of(1, 2).pipeThrough(map((n) => n * 10)); // 10, 20
 */
export function map<In, Out>(
  project: (value: In, index: number) => Out | PromiseLike<Out>,
): Operator<In, Out> {
  let index = 0;
  return createTransform<In, Out>({
    transform(chunk, controller) {
      const result = project(chunk, index++);
      // Await only real promises: an async transform costs every value a microtask.
      if (!isPromiseLike(result)) {
        controller.enqueue(result);
        return;
      }
      return Promise.resolve(result).then((value) => {
        controller.enqueue(value);
      });
    },
  });
}
