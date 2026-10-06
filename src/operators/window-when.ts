import { drain } from "../internal/drain.js";
import { operator } from "../internal/operator.js";
import { watchFirst, type Watch } from "../internal/watch-first.js";
import { createStream } from "../sources/create-stream.js";
import { external, type External } from "../sources/external.js";
import type { Observable, Operator } from "../types.js";

/**
 * Splits the source into consecutive windows. Each window stays open until
 * the stream from `closingSelector()` emits or completes; then a new window
 * opens with a fresh closing stream. The first window opens immediately.
 *
 * @example
 * clicks.pipeThrough(windowWhen(() => timer(1000)));
 */
export function windowWhen<T>(
  closingSelector: () => Observable<unknown>,
): Operator<T, Observable<T>> {
  return operator((source) =>
    createStream<Observable<T>>(async (subscriber) => {
      let current: External<T> | undefined;
      let closing: Watch | undefined;
      const fail = (error: unknown): void => {
        current?.error(error);
        subscriber.error(error);
      };
      const openWindow = (): void => {
        closing?.cancel();
        current?.complete();
        if (subscriber.closed) return;
        current = external<T>();
        subscriber.next(current.observable);
        const watch = watchFirst(closingSelector(), subscriber.signal);
        closing = watch;
        watch.fired
          .then(() => {
            if (closing === watch && !subscriber.closed) openWindow();
          })
          .catch(fail);
      };
      subscriber.signal.addEventListener(
        "abort",
        () => {
          current?.complete();
        },
        { once: true },
      );
      openWindow();
      try {
        await drain(
          source,
          (value) => {
            current?.next(value);
          },
          subscriber.signal,
        );
      } catch (error) {
        fail(error);
        return;
      }
      closing?.cancel();
      current?.complete();
      subscriber.complete();
    }),
  );
}
