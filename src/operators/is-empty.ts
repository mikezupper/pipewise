import { createTransform } from "../internal/transform.js";
import type { Operator } from "../types.js";

/**
 * Emits `false` and completes at the first value, cancelling the source, or
 * emits `true` if the source completes without one.
 *
 * @example
 * of().pipeThrough(isEmpty()); // true
 */
export function isEmpty<T>(): Operator<T, boolean> {
  return createTransform<T, boolean>({
    transform(_chunk, controller) {
      controller.enqueue(false);
      controller.terminate();
    },
    flush(controller) {
      controller.enqueue(true);
    },
  });
}
