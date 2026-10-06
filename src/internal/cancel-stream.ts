import { noop } from "./noop.js";

/**
 * Releases a value an operator received but will never process. If it is a
 * stream nobody is reading, it is cancelled so its listeners and timers stop.
 * Any other value needs no cleanup.
 */
export function discardValue(value: unknown): void {
  if (value instanceof ReadableStream && !value.locked) value.cancel().catch(noop);
}
