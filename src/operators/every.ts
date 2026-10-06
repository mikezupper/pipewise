import { createTransform } from "../internal/transform.js";
import type { Operator } from "../types.js";

/**
 * Emits `false` and completes at the first value that fails `predicate`,
 * cancelling the source, or emits `true` when the source completes.
 *
 * @example
 * of(2, 4, 6).pipeThrough(every((n) => n % 2 === 0)); // true
 */
export function every<T>(predicate: (value: T, index: number) => boolean): Operator<T, boolean> {
  let index = 0;
  return createTransform<T, boolean>({
    transform(chunk, controller) {
      if (predicate(chunk, index++)) return;
      controller.enqueue(false);
      controller.terminate();
    },
    flush(controller) {
      controller.enqueue(true);
    },
  });
}
