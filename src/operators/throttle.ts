import { drain } from "../internal/drain.js";
import { operator } from "../internal/operator.js";
import { watchFirst, type Watch } from "../internal/watch-first.js";
import { createStream } from "../sources/create-stream.js";
import type { Observable, Operator } from "../types.js";

/** Options for `throttle()` and `throttleTime()`. */
export interface ThrottleOptions {
  /** Emit the value that opens a window. Defaults to `true`. */
  readonly leading?: boolean;
  /** Emit the last value seen during a window when it closes. Defaults to `false`. */
  readonly trailing?: boolean;
}

/**
 * Emits a value, then ignores values until `durationSelector(value)` emits.
 * With `trailing`, the last ignored value is emitted when the window closes
 * and opens the next window. Completion waits for a pending trailing value.
 *
 * @example
 * clicks.pipeThrough(throttle(() => timer(1000), { trailing: true }));
 */
export function throttle<T>(
  durationSelector: (value: T) => Observable<unknown>,
  options: ThrottleOptions = {},
): Operator<T> {
  const { leading = true, trailing = false } = options;
  return operator((source) =>
    createStream<T>(async (subscriber) => {
      let pending: { value: T } | undefined;
      let throttled: Watch | undefined;
      let sourceDone = false;
      const send = (): void => {
        if (!pending) return;
        const { value } = pending;
        pending = undefined;
        subscriber.next(value);
        if (!sourceDone) start(value);
      };
      const start = (value: T): void => {
        const watch = watchFirst(durationSelector(value), subscriber.signal);
        throttled = watch;
        watch.fired
          .then((fired) => {
            if (throttled !== watch) return;
            throttled = undefined;
            if (fired && trailing) send();
            if (sourceDone) subscriber.complete();
          })
          .catch((error: unknown) => {
            subscriber.error(error);
          });
      };
      await drain(
        source,
        (value) => {
          pending = { value };
          if (throttled) return;
          if (leading) send();
          else start(value);
        },
        subscriber.signal,
      );
      sourceDone = true;
      if (!(trailing && pending && throttled)) subscriber.complete();
    }),
  );
}
