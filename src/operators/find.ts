import { createTransform } from "../internal/transform.js";
import type { Operator } from "../types.js";

/**
 * Emits the first value that satisfies `predicate` and completes, cancelling
 * the source, or emits `undefined` if none does.
 *
 * @example
 * of(1, 5, 9).pipeThrough(find((n) => n > 3)); // 5
 */
export function find<T>(
  predicate: (value: T, index: number) => boolean,
): Operator<T, T | undefined> {
  let index = 0;
  return createTransform<T, T | undefined>({
    transform(chunk, controller) {
      if (!predicate(chunk, index++)) return;
      controller.enqueue(chunk);
      controller.terminate();
    },
    flush(controller) {
      controller.enqueue(undefined);
    },
  });
}
