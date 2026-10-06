import { timer } from "../sources/timer.js";
import type { Operator } from "../types.js";
import { audit } from "./audit.js";

/**
 * After a value arrives, waits `ms` milliseconds, then emits the most recent
 * value. Values during the wait only update what will be emitted.
 *
 * @example
 * scrollEvents.pipeThrough(auditTime(100));
 */
export function auditTime<T>(ms: number): Operator<T> {
  return audit<T>(() => timer(ms));
}
