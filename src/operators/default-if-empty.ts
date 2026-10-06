import { createTransform } from "../internal/transform.js";
import type { Operator } from "../types.js";

/**
 * Passes values through, or emits `defaultValue` if the source completes
 * without emitting.
 *
 * @example
 * empty().pipeThrough(defaultIfEmpty("none")); // "none"
 */
export function defaultIfEmpty<T, D>(defaultValue: D): Operator<T, T | D> {
  let empty = true;
  return createTransform<T, T | D>({
    transform(chunk, controller) {
      empty = false;
      controller.enqueue(chunk);
    },
    flush(controller) {
      if (empty) controller.enqueue(defaultValue);
    },
  });
}
