import { timer } from "../sources/timer.js";
import type { Operator } from "../types.js";
import { throttle, type ThrottleOptions } from "./throttle.js";

/**
 * Emits at most one value per `ms` milliseconds. By default that is the first
 * value in each window; set `trailing` to also emit the last, when the window
 * closes. Completion waits for a pending trailing value.
 *
 * @example
 * scrollEvents.pipeThrough(throttleTime(100, { trailing: true }));
 */
export function throttleTime<T>(ms: number, options: ThrottleOptions = {}): Operator<T> {
  return throttle<T>(() => timer(ms), options);
}
