import { noop } from "../internal/noop.js";
import { createStream } from "../sources/create-stream.js";
import type { Observable } from "../types.js";

/** Thrown internally to stop waiting on the other reads when one source completes. */
class SourceDone extends Error {}

/**
 * Emits arrays pairing the nth value of every source. Completes as soon as
 * any source completes, cancelling the rest.
 *
 * @example
 * zip(of("a", "b"), of(1, 2)); // ["a", 1], ["b", 2]
 */
export function zip<T extends readonly unknown[]>(
  ...sources: { [K in keyof T]: Observable<T[K]> }
): Observable<T> {
  return createStream<T>(async (subscriber) => {
    const readers = sources.map((source) => source.getReader());
    const cancelAll = (): void => {
      for (const reader of readers) reader.cancel(subscriber.signal.reason).catch(noop);
    };
    subscriber.signal.addEventListener("abort", cancelAll, { once: true });
    try {
      if (readers.length === 0) {
        subscriber.complete();
        return;
      }
      for (;;) {
        await subscriber.ready();
        if (subscriber.closed) return;
        let values: unknown[];
        try {
          values = await Promise.all(
            readers.map(async (reader) => {
              const result = await reader.read();
              if (result.done) throw new SourceDone();
              return result.value;
            }),
          );
        } catch (reason) {
          if (reason instanceof SourceDone) {
            subscriber.complete();
            return;
          }
          throw reason;
        }
        subscriber.next(values as unknown as T);
      }
    } finally {
      cancelAll();
      subscriber.signal.removeEventListener("abort", cancelAll);
      for (const reader of readers) reader.releaseLock();
    }
  });
}
