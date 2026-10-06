import { drain } from "../internal/drain.js";
import { operator } from "../internal/operator.js";
import { createStream } from "../sources/create-stream.js";
import { external, type External } from "../sources/external.js";
import type { Observable, Operator } from "../types.js";

/**
 * Splits the source into consecutive windows, each a stream of its own. The
 * first window opens immediately; each time `notifier` emits, the current
 * window completes and a new one opens. Completing the source completes the
 * current window and the output. Values in a window nobody reads are queued.
 *
 * @example
 * source.pipeThrough(window(interval(1000))).pipeThrough(mergeMap((w) => w.pipeThrough(count())));
 */
export function window<T>(notifier: Observable<unknown>): Operator<T, Observable<T>> {
  return operator((source) =>
    createStream<Observable<T>>(async (subscriber) => {
      let current: External<T> = external<T>();
      subscriber.next(current.observable);
      subscriber.signal.addEventListener(
        "abort",
        () => {
          current.complete();
        },
        { once: true },
      );
      const fail = (error: unknown): void => {
        current.error(error);
        subscriber.error(error);
      };
      drain(
        notifier,
        () => {
          current.complete();
          current = external<T>();
          subscriber.next(current.observable);
        },
        subscriber.signal,
      ).catch(fail);
      try {
        await drain(
          source,
          (value) => {
            current.next(value);
          },
          subscriber.signal,
        );
      } catch (error) {
        fail(error);
        return;
      }
      current.complete();
      subscriber.complete();
    }),
  );
}
