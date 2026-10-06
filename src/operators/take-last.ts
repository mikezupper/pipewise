import { createTransform } from "../internal/transform.js";
import type { Operator } from "../types.js";
import { Queue } from "../internal/queue.js";

/**
 * Emits the last `count` values when the source completes.
 *
 * @example
 * of(1, 2, 3, 4).pipeThrough(takeLast(2)); // 3, 4
 */
export function takeLast<T>(count: number): Operator<T> {
  const held = new Queue<T>();
  return createTransform<T, T>({
    transform(chunk) {
      if (count <= 0) return;
      held.push(chunk);
      if (held.length > count) held.shift();
    },
    flush(controller) {
      while (held.length > 0) controller.enqueue(held.shift());
    },
  });
}
