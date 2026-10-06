import { drain } from "../internal/drain.js";
import { operator } from "../internal/operator.js";
import { watchFirst, type Watch } from "../internal/watch-first.js";
import { createStream } from "../sources/create-stream.js";
import type { Observable, Operator } from "../types.js";

/**
 * Like `debounceTime()`, but each value chooses its own quiet period: the
 * value is emitted when `durationSelector(value)` emits, unless a newer value
 * arrives first. A pending value is emitted when the source completes.
 *
 * @example
 * input.pipeThrough(debounce((text) => timer(text.length < 3 ? 500 : 150)));
 */
export function debounce<T>(durationSelector: (value: T) => Observable<unknown>): Operator<T> {
  return operator((source) =>
    createStream<T>(async (subscriber) => {
      let pending: { value: T } | undefined;
      let current: Watch | undefined;
      const emit = (): void => {
        current?.cancel();
        current = undefined;
        if (!pending) return;
        const { value } = pending;
        pending = undefined;
        subscriber.next(value);
      };
      await drain(
        source,
        (value) => {
          current?.cancel();
          pending = { value };
          const watch = watchFirst(durationSelector(value), subscriber.signal);
          current = watch;
          watch.fired.then(
            (fired) => {
              if (fired && current === watch) emit();
            },
            (error: unknown) => {
              subscriber.error(error);
            },
          );
        },
        subscriber.signal,
      );
      emit();
      subscriber.complete();
    }),
  );
}
