import { discardValue } from "../internal/cancel-stream.js";
import { drain } from "../internal/drain.js";
import { operator } from "../internal/operator.js";
import { createStream } from "../sources/create-stream.js";
import type { Observable, Operator } from "../types.js";

/**
 * Maps each value to a stream and emits from all of them as values arrive,
 * reading at most `concurrent` streams at once. `project` is not called for a
 * value until a slot is free.
 *
 * @example
 * ids.pipeThrough(mergeMap((id) => fromAsyncFunction(() => load(id)), 4));
 */
export function mergeMap<In, Out>(
  project: (value: In, index: number) => Observable<Out>,
  concurrent: number = Infinity,
): Operator<In, Out> {
  if (!(concurrent >= 1)) throw new RangeError("concurrency must be at least 1");
  return operator<In, Out>(
    (source) =>
      createStream<Out>(async (subscriber) => {
        const active = new Set<Promise<void>>();
        let wake: (() => void) | undefined;
        let index = 0;
        await drain(
          source,
          async (value) => {
            while (active.size >= concurrent)
              await new Promise<void>((resolve) => {
                wake = resolve;
              });
            if (subscriber.closed) {
              discardValue(value);
              return;
            }
            const task: Promise<void> = drain(
              project(value, index++),
              (inner) => {
                subscriber.next(inner);
              },
              subscriber.signal,
              () => subscriber.ready(),
            )
              .catch((error: unknown) => {
                subscriber.error(error);
              })
              .finally(() => {
                active.delete(task);
                wake?.();
                wake = undefined;
              });
            active.add(task);
          },
          subscriber.signal,
          undefined,
          discardValue,
        );
        await Promise.all(active);
        subscriber.complete();
      }),
    discardValue,
  );
}
