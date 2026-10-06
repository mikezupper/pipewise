import { childController } from "../internal/child-signal.js";
import { discardValue } from "../internal/cancel-stream.js";
import { drain } from "../internal/drain.js";
import { operator } from "../internal/operator.js";
import { createStream } from "../sources/create-stream.js";
import type { Observable, Operator } from "../types.js";

/**
 * Takes a stream of streams and emits values from the most recent one,
 * cancelling the previous inner stream each time a new one arrives.
 * Completes when the outer stream and the last inner stream complete.
 *
 * @example
 * queries.pipeThrough(map(search)).pipeThrough(switchAll());
 */
export function switchAll<T>(): Operator<Observable<T>, T> {
  return operator<Observable<T>, T>(
    (source) =>
      createStream<T>(async (subscriber) => {
        let current: AbortController | undefined;
        let currentDone: Promise<void> = Promise.resolve();
        await drain(
          source,
          (inner) => {
            current?.abort();
            const controller = childController(subscriber.signal);
            current = controller;
            currentDone = drain(
              inner,
              (value) => {
                subscriber.next(value);
              },
              controller.signal,
              () => subscriber.ready(),
            ).catch((error: unknown) => {
              subscriber.error(error);
            });
          },
          subscriber.signal,
          undefined,
          discardValue,
        );
        await currentDone;
        subscriber.complete();
      }),
    discardValue,
  );
}
