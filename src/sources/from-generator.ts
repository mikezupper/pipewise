import type { Observable } from "../types.js";
import { defer } from "./defer.js";
import { fromIterable } from "./from-iterable.js";

/**
 * Emits the values of a generator function. The generator is not started
 * until the first value is read.
 *
 * @example
 * fromGenerator(function* () { let i = 0; while (true) yield i++; });
 */
export function fromGenerator<T>(f: () => Iterator<T>): Observable<T> {
  return defer(() => {
    const iterator = f();
    return fromIterable({ [Symbol.iterator]: () => iterator });
  });
}
