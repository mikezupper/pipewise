import { createTransform } from "../internal/transform.js";
import type { Operator } from "../types.js";

/**
 * Collects values into arrays of `size`. A new array starts every
 * `startBufferEvery` values (default: `size`), so arrays can overlap or skip
 * values. Arrays still open when the source completes are emitted then.
 *
 * @example
 * of(1, 2, 3).pipeThrough(bufferCount(2)); // [1, 2], [3]
 * of(1, 2, 3, 4).pipeThrough(bufferCount(2, 1)); // [1, 2], [2, 3], [3, 4], [4]
 */
export function bufferCount<T>(size: number, startBufferEvery: number = size): Operator<T, T[]> {
  if (!(size >= 1)) throw new RangeError("bufferCount size must be at least 1");
  if (!(startBufferEvery >= 1))
    throw new RangeError("bufferCount startBufferEvery must be at least 1");
  let buffers: T[][] = [];
  let count = 0;
  return createTransform<T, T[]>({
    transform(chunk, controller) {
      if (count++ % startBufferEvery === 0) buffers.push([]);
      for (const buffer of buffers) buffer.push(chunk);
      const full = buffers.filter((buffer) => buffer.length >= size);
      if (full.length === 0) return;
      buffers = buffers.filter((buffer) => buffer.length < size);
      for (const buffer of full) controller.enqueue(buffer);
    },
    flush(controller) {
      for (const buffer of buffers) controller.enqueue(buffer);
    },
  });
}
