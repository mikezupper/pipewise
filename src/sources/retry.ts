import { drain } from "../internal/drain.js";
import { sleep } from "../internal/sleep.js";
import { watchFirst } from "../internal/watch-first.js";
import type { Observable } from "../types.js";
import { createStream } from "./create-stream.js";

/**
 * How long to wait before a retry: milliseconds, or a stream whose first value
 * starts the retry. A stream that completes without emitting ends `retry()`
 * normally, as in RxJS.
 */
export type RetryDelay = number | Observable<unknown>;

/** Options for `retry()`. */
export interface RetryOptions {
  /** Retries after the first failure. Defaults to `Infinity`. */
  readonly count?: number;
  /**
   * Milliseconds to wait before each retry, or a function of the error and the
   * 1-based retry number that returns the wait (see `backoff()`). Throw from
   * the function to stop retrying with that error. Defaults to `0`.
   */
  readonly delay?: number | ((error: unknown, retryCount: number) => RetryDelay);
  /** Return `false` to fail with the error instead of retrying. Defaults to retrying every error. */
  readonly retriable?: (error: unknown) => boolean;
  /** Reset the retry count each time a value arrives. Defaults to `false`. */
  readonly resetOnSuccess?: boolean;
}

/**
 * Emits the values of `factory()`, and calls `factory()` again for a fresh
 * stream each time one errors, up to `count` times. Values emitted before an
 * error are not taken back. Cancelling during a wait starts no further attempt.
 *
 * Takes a factory, unlike RxJS's operator, because a stream can only be read once.
 * `delay` and `resetOnSuccess` behave as in RxJS; `retriable` is an addition.
 *
 * @example
 * retry(() => fromFetch(url).pipeThrough(responseText()), {
 *   count: 5,
 *   delay: backoff({ baseMs: 100, maxMs: 5000, jitter: true }),
 *   retriable: (error) => !(error instanceof HttpError && error.status < 500),
 * });
 */
export function retry<T>(factory: () => Observable<T>, options: RetryOptions = {}): Observable<T> {
  const { count = Infinity, delay = 0, retriable, resetOnSuccess = false } = options;
  return createStream<T>(async (subscriber) => {
    let retries = 0;
    for (;;) {
      try {
        await drain(
          factory(),
          (value) => {
            if (resetOnSuccess) retries = 0;
            subscriber.next(value);
          },
          subscriber.signal,
          () => subscriber.ready(),
        );
        subscriber.complete();
        return;
      } catch (error) {
        if (subscriber.closed) return;
        if (retries >= count || (retriable && !retriable(error))) throw error;
        retries++;
        const wait = typeof delay === "function" ? delay(error, retries) : delay;
        if (typeof wait === "number") {
          if (wait > 0) await sleep(wait, subscriber.signal);
        } else if (!(await watchFirst(wait, subscriber.signal).fired)) {
          subscriber.complete();
          return;
        }
        if (subscriber.signal.aborted) return;
      }
    }
  });
}
