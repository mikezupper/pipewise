import type { Observable } from "../types.js";
import { share } from "./share.js";

/**
 * Splits one stream into two: values that satisfy `predicate`, and the rest.
 * Both branches read the source together (see `share()`), so read both or
 * cancel the one you do not need.
 *
 * @example
 * const [evens, odds] = partition(of(1, 2, 3, 4), (n) => n % 2 === 0);
 */
export function partition<T>(
  source: Observable<T>,
  predicate: (value: T, index: number) => boolean,
): [Observable<T>, Observable<T>] {
  const branch = share(source);
  const split = (keep: boolean): Observable<T> => {
    let index = 0;
    return branch().pipeThrough(
      new TransformStream<T, T>(
        {
          transform(chunk, controller) {
            if (predicate(chunk, index++) === keep) controller.enqueue(chunk);
          },
        },
        { highWaterMark: 1 },
        { highWaterMark: 0 },
      ),
    );
  };
  return [split(true), split(false)];
}
