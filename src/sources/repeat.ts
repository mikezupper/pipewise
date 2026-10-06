import { drain } from "../internal/drain.js";
import { sleep } from "../internal/sleep.js";
import type { Observable } from "../types.js";
import { createStream } from "./create-stream.js";

/** Options for `repeat()`. */
export interface RepeatOptions {
  /** Total number of streams to read. Defaults to `Infinity`. */
  readonly count?: number;
  /** Milliseconds to wait before reading the next stream. Defaults to `0`. */
  readonly delay?: number;
}

/**
 * Emits the values of `factory()`, then of a fresh `factory()` each time the
 * previous stream completes, `count` streams in all. An error ends it.
 *
 * Takes a factory, unlike RxJS's operator, because a stream can only be read once.
 *
 * @example
 * repeat(() => fromAsyncFunction(poll), { count: 5, delay: 1000 });
 */
export function repeat<T>(
  factory: () => Observable<T>,
  options: RepeatOptions = {},
): Observable<T> {
  const { count = Infinity, delay = 0 } = options;
  return createStream<T>(async (subscriber) => {
    for (let round = 0; round < count && !subscriber.closed; round++) {
      if (round > 0 && delay > 0) await sleep(delay, subscriber.signal);
      if (subscriber.signal.aborted) return;
      await drain(
        factory(),
        (value) => {
          subscriber.next(value);
        },
        subscriber.signal,
        () => subscriber.ready(),
      );
    }
    subscriber.complete();
  });
}
