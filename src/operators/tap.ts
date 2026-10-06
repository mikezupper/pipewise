import { createTransform } from "../internal/transform.js";
import { isPromiseLike } from "../internal/is-promise-like.js";
import type { Operator } from "../types.js";

/**
 * Calls `f` with each value for its side effect and passes the value on
 * unchanged. A returned promise is awaited first. If `f` throws, the stream errors.
 *
 * @example
 * source.pipeThrough(tap((v) => console.log("saw", v)));
 */
export function tap<T>(f: (value: T) => unknown): Operator<T> {
  return createTransform<T, T>({
    transform(chunk, controller) {
      const pending = f(chunk);
      if (!isPromiseLike(pending)) {
        controller.enqueue(chunk);
        return;
      }
      return Promise.resolve(pending).then(() => {
        controller.enqueue(chunk);
      });
    },
  });
}
