import { drain } from "../internal/drain.js";
import { noop } from "../internal/noop.js";
import { createStream } from "../sources/create-stream.js";
import type { Observable } from "../types.js";

/**
 * Mirrors whichever source acts first, whether it emits, completes, or
 * errors. Every other source is cancelled.
 *
 * @example
 * race(fromPromise(primary()), fromPromise(fallback()));
 */
export function race<T extends readonly unknown[]>(
  ...sources: { [K in keyof T]: Observable<T[K]> }
): Observable<T[number]> {
  return createStream<T[number]>(async (subscriber) => {
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
      const { index, result } = await Promise.race(
        readers.map((reader, i) => reader.read().then((read) => ({ index: i, result: read }))),
      );
      readers.forEach((reader, i) => {
        if (i !== index) reader.cancel().catch(noop);
      });
      const winner = readers[index];
      const source = sources[index];
      if (!winner || !source) return;
      if (result.done) {
        subscriber.complete();
        return;
      }
      subscriber.next(result.value);
      winner.releaseLock();
      await drain(
        source,
        (value) => {
          subscriber.next(value);
        },
        subscriber.signal,
        () => subscriber.ready(),
      );
      subscriber.complete();
    } finally {
      cancelAll();
      subscriber.signal.removeEventListener("abort", cancelAll);
      for (const reader of readers) reader.releaseLock();
    }
  });
}
