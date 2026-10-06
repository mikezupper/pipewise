import type { Observable, Operator } from "../types.js";
import { exhaustMap } from "./exhaust-map.js";

/** Options for `exhaustAll()`. */
export interface ExhaustAllOptions<T> {
  /** Called synchronously for each inner stream ignored, after it is cancelled. */
  readonly onDrop?: (inner: Observable<T>) => void;
}

/**
 * Takes a stream of streams and emits values from one inner stream at a time.
 * Inner streams that arrive while one is active are cancelled and ignored;
 * `onDrop` reports them.
 *
 * @example
 * submitClicks.pipeThrough(map(save)).pipeThrough(exhaustAll()); // ignore double-submits
 */
export function exhaustAll<T>(options: ExhaustAllOptions<T> = {}): Operator<Observable<T>, T> {
  const { onDrop } = options;
  return exhaustMap((inner: Observable<T>) => inner, onDrop ? { onDrop } : {});
}
