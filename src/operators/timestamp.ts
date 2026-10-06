import { createTransform } from "../internal/transform.js";
import type { Operator } from "../types.js";

/** A value paired with the time it was emitted. */
export interface Timestamp<T> {
  readonly value: T;
  /** Milliseconds since the epoch, from `Date.now()`. */
  readonly timestamp: number;
}

/**
 * Wraps each value with the time it passed through, from `Date.now()`.
 *
 * @example
 * events.pipeThrough(timestamp()); // { value, timestamp: 1759622400000 }, …
 */
export function timestamp<T>(): Operator<T, Timestamp<T>> {
  return createTransform<T, Timestamp<T>>({
    transform(chunk, controller) {
      controller.enqueue({ value: chunk, timestamp: Date.now() });
    },
  });
}
