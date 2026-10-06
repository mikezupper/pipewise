import { zip } from "../combiners/zip.js";
import { cancelUnread } from "../internal/cancel-unread.js";
import { discardValue } from "../internal/cancel-stream.js";
import { drain } from "../internal/drain.js";
import { operator } from "../internal/operator.js";
import { createStream } from "../sources/create-stream.js";
import type { Observable, Operator } from "../types.js";

/**
 * Takes a stream of streams, waits for it to complete, then pairs the inner streams' values by position with `zip()`.
 * Inner streams held while waiting are cancelled if the output ends first.
 *
 * @example
 * of(of("a", "b"), of(1, 2)).pipeThrough(zipAll()); // ["a", 1], ["b", 2]
 */
export function zipAll<T>(): Operator<Observable<T>, T[]> {
  return operator<Observable<T>, T[]>(
    (source) =>
      createStream<T[]>(async (subscriber) => {
        const inners: Observable<T>[] = [];
        subscriber.signal.addEventListener(
          "abort",
          () => {
            cancelUnread(inners);
          },
          { once: true },
        );
        await drain(
          source,
          (inner) => {
            inners.push(inner);
          },
          subscriber.signal,
          undefined,
          discardValue,
        );
        if (subscriber.closed) return;
        await drain(
          zip(...inners),
          (values) => {
            subscriber.next(values);
          },
          subscriber.signal,
          () => subscriber.ready(),
        );
        subscriber.complete();
      }),
    discardValue,
  );
}
