import { drain } from "../internal/drain.js";
import { operator } from "../internal/operator.js";
import { watchFirst } from "../internal/watch-first.js";
import { createStream } from "../sources/create-stream.js";
import type { Observable, Operator } from "../types.js";

/**
 * Drops source values until `notifier` emits, then emits the rest. A notifier
 * that completes without emitting means nothing is ever emitted.
 *
 * @example
 * keystrokes.pipeThrough(skipUntil(fromEvent(startButton, "click")));
 */
export function skipUntil<T>(notifier: Observable<unknown>): Operator<T> {
  return operator((source) =>
    createStream<T>(async (subscriber) => {
      let taking = false;
      watchFirst(notifier, subscriber.signal).fired.then(
        (fired) => {
          if (fired) taking = true;
        },
        (error: unknown) => {
          subscriber.error(error);
        },
      );
      await drain(
        source,
        (value) => {
          if (taking) subscriber.next(value);
        },
        subscriber.signal,
        () => subscriber.ready(),
      );
      subscriber.complete();
    }),
  );
}
