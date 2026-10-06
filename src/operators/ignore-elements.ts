import { createTransform } from "../internal/transform.js";
import type { Operator } from "../types.js";

/**
 * Drops every value, keeping only completion and errors.
 *
 * @example
 * await collect(saves.pipeThrough(ignoreElements())); // resolves when saving finishes
 */
export function ignoreElements<T>(): Operator<T, never> {
  return createTransform<T, never>({
    transform() {
      // Values are dropped by design.
    },
  });
}
