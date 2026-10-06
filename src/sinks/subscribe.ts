/** Callbacks for `subscribe()`. */
export interface Observer<T> {
  readonly next?: (value: T) => unknown;
  readonly error?: (reason: unknown) => void;
  readonly complete?: () => void;
}

/**
 * Creates the end of a pipeline: a `WritableStream` for `pipeTo()` that calls
 * `next` for each value. Pass an observer to also hear about completion and
 * errors. If `next` returns a promise, the next value waits for it.
 *
 * @example
 * await source.pipeTo(subscribe((value) => render(value)));
 */
export function subscribe<T>(
  observer: Observer<T> | ((value: T) => unknown) = {},
): WritableStream<T> {
  const { next, error, complete } = typeof observer === "function" ? { next: observer } : observer;
  return new WritableStream<T>(
    {
      async write(chunk) {
        await next?.(chunk);
      },
      close() {
        complete?.();
      },
      abort(reason) {
        error?.(reason);
      },
    },
    { highWaterMark: 1 },
  );
}
