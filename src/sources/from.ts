import { isPromiseLike } from "../internal/is-promise-like.js";
import type { Observable } from "../types.js";
import { fromAsyncIterable } from "./from-async-iterable.js";
import { fromIterable } from "./from-iterable.js";
import { fromPromise } from "./from-promise.js";

/** Anything `from()` can turn into a stream. */
export type StreamInput<T> = Observable<T> | PromiseLike<T> | Iterable<T> | AsyncIterable<T>;

/**
 * Converts a stream, promise, iterable, or async iterable into a stream.
 * A `ReadableStream` is returned unchanged.
 *
 * @example
 * from([1, 2, 3]);
 * from(fetch("/api").then((r) => r.json()));
 */
export function from<T>(input: StreamInput<T>): Observable<T> {
  if (input instanceof ReadableStream) return input;
  if (isPromiseLike(input)) return fromPromise(input);
  if (Symbol.asyncIterator in Object(input)) return fromAsyncIterable(input as AsyncIterable<T>);
  if (Symbol.iterator in Object(input)) return fromIterable(input as Iterable<T>);
  throw new TypeError("from() needs a stream, promise, iterable, or async iterable");
}
