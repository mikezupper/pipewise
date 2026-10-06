import { TimeoutError } from "../errors.js";
import { childController } from "../internal/child-signal.js";
import { drain } from "../internal/drain.js";
import { operator } from "../internal/operator.js";
import { createStream } from "../sources/create-stream.js";
import type { Observable, Operator } from "../types.js";

/** What `timeout()`'s `with` function receives when the timer fires. */
export interface TimeoutInfo<T> {
  readonly lastValue: T | undefined;
  readonly seen: number;
}

/** Options for `timeout()`. At least one of `first` and `each` is required. */
export interface TimeoutConfig<T, R> {
  /** Milliseconds (or a deadline) allowed before the first value. */
  readonly first?: number | Date;
  /** Milliseconds allowed between values, and before the first if `first` is unset. */
  readonly each?: number;
  /** Returns the stream to continue with on timeout, instead of erroring. */
  readonly with?: (info: TimeoutInfo<T>) => Observable<R>;
}

/**
 * Errors with `TimeoutError`, and cancels the source, if it is silent too
 * long. A number means `{ each: ms }`: the limit applies before the first value
 * and between values. With `with`, continues with a fallback stream instead.
 *
 * @example
 * responses.pipeThrough(timeout(5000));
 * responses.pipeThrough(timeout({ first: 10_000, each: 1000, with: () => of(cached) }));
 */
export function timeout<T, R = never>(config: number | TimeoutConfig<T, R>): Operator<T, T | R> {
  const { first, each, with: fallback } = typeof config === "number" ? { each: config } : config;
  if (first === undefined && each === undefined) throw new TypeError("No timeout provided");
  return operator((source) =>
    createStream<T | R>(async (subscriber) => {
      const sourceControl = childController(subscriber.signal);
      const next = (value: T | R): void => {
        subscriber.next(value);
      };
      const ready = (): Promise<void> => subscriber.ready();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let seen = 0;
      let lastValue: T | undefined;
      // Set from the timer callback, so it is a property TypeScript will not narrow.
      const state = { switched: false };
      const onTimeout = (): void => {
        if (!fallback) {
          subscriber.error(new TimeoutError());
          return;
        }
        state.switched = true;
        sourceControl.abort();
        Promise.resolve()
          .then(() => drain(fallback({ lastValue, seen }), next, subscriber.signal, ready))
          .then(
            () => {
              subscriber.complete();
            },
            (error: unknown) => {
              subscriber.error(error);
            },
          );
      };
      const arm = (ms: number): void => {
        clearTimeout(timer);
        timer = setTimeout(onTimeout, ms);
      };
      subscriber.signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
        },
        { once: true },
      );
      const firstMs = first instanceof Date ? first.getTime() - Date.now() : first;
      arm(firstMs ?? each ?? 0);
      await drain(
        source,
        (value) => {
          seen++;
          lastValue = value;
          next(value);
          if (each === undefined) clearTimeout(timer);
          else arm(each);
        },
        sourceControl.signal,
        ready,
      );
      if (state.switched) return;
      clearTimeout(timer);
      subscriber.complete();
    }),
  );
}
