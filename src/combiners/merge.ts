import { drain } from "../internal/drain.js";
import { createStream } from "../sources/create-stream.js";
import type { Observable } from "../types.js";

/**
 * Emits every value from every source as it arrives. Completes when all
 * sources complete. Errors as soon as any source errors, cancelling the rest.
 *
 * @example
 * merge(fromEvent(a, "click"), fromEvent(b, "click"));
 */
export function merge<T extends readonly unknown[]>(
  ...sources: { [K in keyof T]: Observable<T[K]> }
): Observable<T[number]> {
  return createStream<T[number]>(async (subscriber) => {
    await Promise.all(
      sources.map((source) =>
        drain(
          source,
          (value) => {
            subscriber.next(value);
          },
          subscriber.signal,
          () => subscriber.ready(),
        ),
      ),
    );
    subscriber.complete();
  });
}
