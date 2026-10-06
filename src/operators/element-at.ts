import { createTransform } from "../internal/transform.js";
import { ArgumentOutOfRangeError } from "../errors.js";
import type { Operator } from "../types.js";

/**
 * Emits the value at position `index` (from 0) and completes, cancelling the
 * source. If the source ends first, emits `defaultValue` when given, or errors
 * with `ArgumentOutOfRangeError`. A negative index throws immediately.
 *
 * @example
 * of("a", "b", "c").pipeThrough(elementAt(1)); // "b"
 */
export function elementAt<T, D = T>(index: number, ...defaultValue: [] | [D]): Operator<T, T | D> {
  if (index < 0) throw new ArgumentOutOfRangeError();
  let position = 0;
  return createTransform<T, T | D>({
    transform(chunk, controller) {
      if (position++ !== index) return;
      controller.enqueue(chunk);
      controller.terminate();
    },
    flush(controller) {
      if (defaultValue.length === 0) throw new ArgumentOutOfRangeError();
      controller.enqueue(defaultValue[0]);
    },
  });
}
