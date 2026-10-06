import { drain } from "../internal/drain.js";
import { createStream } from "../sources/create-stream.js";
import type { Observable } from "../types.js";

/**
 * Waits for every source to complete, then emits one array of each source's
 * last value. Completes without emitting if any source emits nothing.
 *
 * @example
 * forkJoin(fromPromise(getUser()), fromPromise(getPrefs())); // [user, prefs]
 */
export function forkJoin<T extends readonly unknown[]>(
  ...sources: { [K in keyof T]: Observable<T[K]> }
): Observable<T> {
  return createStream<T>(async (subscriber) => {
    const last = new Array<unknown>(sources.length);
    const seen = new Array<boolean>(sources.length).fill(false);
    await Promise.all(
      sources.map((source, index) =>
        drain(
          source,
          (value) => {
            seen[index] = true;
            last[index] = value;
          },
          subscriber.signal,
        ).then(() => {
          if (!seen[index]) subscriber.complete();
        }),
      ),
    );
    if (subscriber.closed) return;
    if (sources.length > 0 && seen.every(Boolean)) subscriber.next(last as unknown as T);
    subscriber.complete();
  });
}
