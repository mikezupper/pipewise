import type { Observable } from "../types.js";
import { createStream } from "./create-stream.js";

/**
 * Calls `f` and emits the value it resolves to. `f` receives an `AbortSignal`
 * that aborts if the stream is cancelled first, so it can stop a `fetch()`.
 *
 * @example
 * fromAsyncFunction((signal) => fetch("/api", { signal }).then((r) => r.json()));
 */
export function fromAsyncFunction<T>(f: (signal: AbortSignal) => PromiseLike<T>): Observable<T> {
  return createStream<T>(async (subscriber) => {
    const value = await f(subscriber.signal);
    subscriber.next(value);
    subscriber.complete();
  });
}
