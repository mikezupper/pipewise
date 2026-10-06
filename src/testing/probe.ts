/** A hand-driven source that records whether its consumer cancelled it. */
export interface Probe<T> {
  readonly stream: ReadableStream<T>;
  next(value: T): void;
  complete(): void;
  error(reason: unknown): void;
  /** `true` once the consumer has cancelled the stream. */
  readonly cancelled: boolean;
}

/**
 * Creates a source you drive by hand, built on a raw `ReadableStream`. Use it
 * to test that an operator cancels its inputs.
 *
 * @example
 * const source = probe<number>();
 * const result = collect(source.stream.pipeThrough(take(1)));
 * source.next(1);
 * await result; // [1], and source.cancelled is now true
 */
export function probe<T>(): Probe<T> {
  let controller!: ReadableStreamDefaultController<T>;
  let cancelled = false;
  let open = true;
  const stream = new ReadableStream<T>(
    {
      start(c) {
        controller = c;
      },
      cancel() {
        cancelled = true;
        open = false;
      },
    },
    { highWaterMark: 0 },
  );
  return {
    stream,
    next(value) {
      if (open) controller.enqueue(value);
    },
    complete() {
      if (open) controller.close();
      open = false;
    },
    error(reason) {
      if (open) controller.error(reason);
      open = false;
    },
    get cancelled() {
      return cancelled;
    },
  };
}
