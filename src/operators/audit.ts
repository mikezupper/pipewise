import { drain } from "../internal/drain.js";
import { operator } from "../internal/operator.js";
import { watchFirst, type Watch } from "../internal/watch-first.js";
import { createStream } from "../sources/create-stream.js";
import type { Observable, Operator } from "../types.js";

/**
 * When a value arrives, starts `durationSelector(value)` and ignores further
 * timing until it emits; then emits the most recent value. If the source
 * completes during a duration, the last value is emitted when it ends.
 *
 * @example
 * resizeEvents.pipeThrough(audit(() => timer(100)));
 */
export function audit<T>(durationSelector: (value: T) => Observable<unknown>): Operator<T> {
  return operator((source) =>
    createStream<T>(async (subscriber) => {
      let pending: { value: T } | undefined;
      let duration: Watch | undefined;
      let sourceDone = false;
      const endDuration = (fired: boolean): void => {
        duration = undefined;
        if (fired && pending) {
          const { value } = pending;
          pending = undefined;
          subscriber.next(value);
        }
        if (sourceDone) subscriber.complete();
      };
      await drain(
        source,
        (value) => {
          pending = { value };
          if (duration) return;
          duration = watchFirst(durationSelector(value), subscriber.signal);
          duration.fired.then(endDuration, (error: unknown) => {
            subscriber.error(error);
          });
        },
        subscriber.signal,
      );
      sourceDone = true;
      if (!pending || !duration) subscriber.complete();
    }),
  );
}
