import { BufferOverflowError } from "../errors.js";
import { isPromiseLike } from "../internal/is-promise-like.js";
import { reportError } from "../internal/report-error.js";
import { Queue } from "../internal/queue.js";
import type { Observable, Producer, QueueOptions, Subscriber, Teardown } from "../types.js";

/**
 * Creates a stream from a producer function, like `new Observable()` in RxJS.
 *
 * The producer receives a `Subscriber` with `next`, `error`, and `complete`.
 * It may return a teardown function, which runs exactly once when the stream
 * completes, errors, or is cancelled by the consumer.
 *
 * Values pushed while nobody is reading are queued. Pass `queue` to bound the
 * queue and choose what happens when it is full. Values queued before an
 * error or completion are still delivered.
 *
 * @example
 * const clock = createStream((subscriber) => {
 *   const id = setInterval(() => subscriber.next(Date.now()), 1000);
 *   return () => clearInterval(id);
 * }, { buffer: 10, overflow: "dropOldest" });
 */
export function createStream<T>(produce: Producer<T>, queue: QueueOptions = {}): Observable<T> {
  const { buffer = Infinity, overflow = "error" } = queue;
  if (!(buffer >= 0)) throw new RangeError("buffer must be 0 or more");
  const lifetime = new AbortController();
  const queued = new Queue<T>();
  let controller!: ReadableStreamDefaultController<T>;
  let teardown: Teardown | undefined;
  let closed = false;
  let demand = false;
  let ending: { readonly error: boolean; readonly reason?: unknown } | undefined;
  let waiters: Array<() => void> = [];

  const wake = (): void => {
    const pending = waiters;
    waiters = [];
    for (const resolve of pending) resolve();
  };

  const finish = (reason?: unknown): boolean => {
    if (closed) return false;
    closed = true;
    lifetime.abort(reason);
    wake();
    const runTeardown = teardown;
    teardown = undefined;
    if (runTeardown) {
      try {
        runTeardown();
      } catch (error) {
        reportError(error);
      }
    }
    return true;
  };

  /** Closes or errors the stream once every queued value has been read. */
  const settle = (): void => {
    if (!ending || queued.length > 0) return;
    if (ending.error) controller.error(ending.reason);
    else controller.close();
  };

  const subscriber: Subscriber<T> = {
    next(value) {
      if (closed) return;
      if (demand) {
        demand = false;
        controller.enqueue(value);
        return;
      }
      if (queued.length >= buffer) {
        if (overflow === "error") {
          subscriber.error(new BufferOverflowError());
          return;
        }
        if (overflow === "dropNewest" || buffer === 0) return;
        queued.shift();
      }
      queued.push(value);
    },
    error(reason) {
      if (!finish(reason)) return;
      ending = { error: true, reason };
      settle();
    },
    complete() {
      if (!finish()) return;
      ending = { error: false };
      settle();
    },
    ready() {
      if (closed || demand) return Promise.resolve();
      return new Promise((resolve) => waiters.push(resolve));
    },
    signal: lifetime.signal,
    get closed() {
      return closed;
    },
  };

  return new ReadableStream<T>(
    {
      start(c) {
        controller = c;
        try {
          const result = produce(subscriber);
          if (typeof result === "function") {
            if (closed) result();
            else teardown = result;
          } else if (isPromiseLike(result)) {
            result.then(undefined, (error: unknown) => {
              subscriber.error(error);
            });
          }
        } catch (error) {
          if (closed) reportError(error);
          else subscriber.error(error);
        }
      },
      pull(c) {
        if (queued.length > 0) {
          c.enqueue(queued.shift() as T);
          settle();
          return;
        }
        if (ending) {
          settle();
          return;
        }
        demand = true;
        wake();
      },
      cancel(reason) {
        queued.clear();
        finish(reason);
      },
    },
    { highWaterMark: 0 },
  );
}
