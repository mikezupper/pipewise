import { drain } from "../internal/drain.js";
import { operator } from "../internal/operator.js";
import { createStream } from "../sources/create-stream.js";
import type { Observable, Operator } from "../types.js";

/**
 * Emits source values until `notifier` emits, then completes and cancels both.
 * A notifier that completes without emitting has no effect.
 *
 * @example
 * fromEvent(window, "mousemove").pipeThrough(takeUntil(fromEvent(window, "mouseup")));
 */
export function takeUntil<T>(notifier: Observable<unknown>): Operator<T> {
  return operator((source) =>
    createStream<T>(async (subscriber) => {
      drain(
        notifier,
        () => {
          subscriber.complete();
        },
        subscriber.signal,
      ).catch((error: unknown) => {
        subscriber.error(error);
      });
      await drain(
        source,
        (value) => {
          subscriber.next(value);
        },
        subscriber.signal,
        () => subscriber.ready(),
      );
      subscriber.complete();
    }),
  );
}
