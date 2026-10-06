import type { Observable } from "../types.js";
import { fromIterable } from "./from-iterable.js";

/** Options for `generate()`, shaped like a `for` loop. */
export interface GenerateOptions<S, T> {
  readonly initialState: S;
  /** Stops when this returns false. Omit to loop forever. */
  readonly condition?: (state: S) => boolean;
  readonly iterate: (state: S) => S;
  /** Maps each state to the value emitted. Defaults to the state itself. */
  readonly resultSelector?: (state: S) => T;
}

/**
 * Emits values produced by a `for`-loop-shaped description, one per read.
 *
 * @example
 * generate({ initialState: 1, condition: (n) => n <= 8, iterate: (n) => n * 2 }); // 1, 2, 4, 8
 */
export function generate<S, T = S>(options: GenerateOptions<S, T>): Observable<T> {
  const { initialState, condition, iterate, resultSelector } = options;
  return fromIterable({
    *[Symbol.iterator]() {
      for (let state = initialState; !condition || condition(state); state = iterate(state)) {
        yield resultSelector ? resultSelector(state) : (state as unknown as T);
      }
    },
  });
}
