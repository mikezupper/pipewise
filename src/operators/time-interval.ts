import { createTransform } from "../internal/transform.js";
import type { Operator } from "../types.js";

/** A value paired with the milliseconds since the previous one. */
export interface TimeInterval<T> {
  readonly value: T;
  readonly interval: number;
}

/**
 * Wraps each value with the milliseconds elapsed since the previous value,
 * or since the stream started for the first.
 *
 * @example
 * clicks.pipeThrough(timeInterval()); // { value, interval: 312 }, …
 */
export function timeInterval<T>(): Operator<T, TimeInterval<T>> {
  let last = Date.now();
  return createTransform<T, TimeInterval<T>>({
    start() {
      last = Date.now();
    },
    transform(chunk, controller) {
      const now = Date.now();
      controller.enqueue({ value: chunk, interval: now - last });
      last = now;
    },
  });
}
