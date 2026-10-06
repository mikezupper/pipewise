import { lazyStream } from "../internal/lazy-stream.js";
import type { Observable } from "../types.js";

/**
 * Calls `factory` when the first value is read and emits the values of the
 * stream it returns. Use it to postpone creating a stream until it is needed.
 *
 * @example
 * const now = defer(() => of(Date.now())); // the time of the first read
 */
export function defer<T>(factory: () => Observable<T>): Observable<T> {
  return lazyStream(factory);
}
