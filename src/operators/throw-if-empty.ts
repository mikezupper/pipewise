import { createTransform } from "../internal/transform.js";
import { EmptyError } from "../errors.js";
import type { Operator } from "../types.js";

/**
 * Passes values through, or errors with `errorFactory()` (default:
 * `EmptyError`) if the source completes without emitting.
 *
 * @example
 * results.pipeThrough(throwIfEmpty(() => new Error("no results")));
 */
export function throwIfEmpty<T>(errorFactory: () => unknown = () => new EmptyError()): Operator<T> {
  let empty = true;
  return createTransform<T, T>({
    transform(chunk, controller) {
      empty = false;
      controller.enqueue(chunk);
    },
    flush() {
      if (empty) throw errorFactory();
    },
  });
}
