import type { Observable } from "../types.js";
import { createStream } from "./create-stream.js";

/**
 * Emits the promise's value and completes, or errors if it rejects.
 *
 * @example
 * fromPromise(fetch("/api").then((r) => r.json()));
 */
export function fromPromise<T>(promise: PromiseLike<T>): Observable<T> {
  return createStream<T>((subscriber) => {
    promise.then(
      (value) => {
        subscriber.next(value);
        subscriber.complete();
      },
      (error: unknown) => {
        subscriber.error(error);
      },
    );
  });
}
