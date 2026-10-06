import { createTransform } from "../internal/transform.js";
import type { Operator } from "../types.js";

/**
 * Emits the index of the first value that satisfies `predicate` and
 * completes, cancelling the source, or emits `-1` if none does.
 *
 * @example
 * of("a", "b", "c").pipeThrough(findIndex((s) => s === "b")); // 1
 */
export function findIndex<T>(predicate: (value: T, index: number) => boolean): Operator<T, number> {
  let index = 0;
  return createTransform<T, number>({
    transform(chunk, controller) {
      const i = index++;
      if (!predicate(chunk, i)) return;
      controller.enqueue(i);
      controller.terminate();
    },
    flush(controller) {
      controller.enqueue(-1);
    },
  });
}
