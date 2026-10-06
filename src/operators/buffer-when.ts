import { drain } from "../internal/drain.js";
import { operator } from "../internal/operator.js";
import { watchFirst, type Watch } from "../internal/watch-first.js";
import { createStream } from "../sources/create-stream.js";
import type { Observable, Operator } from "../types.js";

/**
 * Collects values into an array until the stream from `closingSelector()`
 * emits, then emits the array and starts the next one with a fresh closing
 * stream. The last array is emitted when the source completes.
 *
 * @example
 * clicks.pipeThrough(bufferWhen(() => timer(1000 + Math.random() * 4000)));
 */
export function bufferWhen<T>(closingSelector: () => Observable<unknown>): Operator<T, T[]> {
  return operator((source) =>
    createStream<T[]>(async (subscriber) => {
      let buffered: T[] | undefined;
      let closing: Watch | undefined;
      const openBuffer = (): void => {
        closing?.cancel();
        const previous = buffered;
        buffered = [];
        if (previous) subscriber.next(previous);
        const watch = watchFirst(closingSelector(), subscriber.signal);
        closing = watch;
        watch.fired
          .then((fired) => {
            if (fired && closing === watch) openBuffer();
          })
          .catch((error: unknown) => {
            subscriber.error(error);
          });
      };
      openBuffer();
      await drain(
        source,
        (value) => {
          buffered?.push(value);
        },
        subscriber.signal,
      );
      closing?.cancel();
      if (buffered) subscriber.next(buffered);
      subscriber.complete();
    }),
  );
}
