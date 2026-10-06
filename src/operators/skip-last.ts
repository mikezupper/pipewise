import { createTransform } from "../internal/transform.js";
import type { Operator } from "../types.js";
import { Queue } from "../internal/queue.js";

/**
 * Drops the last `count` values. Each value is emitted once `count` newer
 * values have arrived.
 *
 * @example
 * of(1, 2, 3, 4).pipeThrough(skipLast(2)); // 1, 2
 */
export function skipLast<T>(count: number): Operator<T> {
  const held = new Queue<T>();
  return createTransform<T, T>({
    transform(chunk, controller) {
      held.push(chunk);
      if (held.length > count) controller.enqueue(held.shift());
    },
  });
}
