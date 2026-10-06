import { drain } from "../internal/drain.js";
import { createStream } from "../sources/create-stream.js";
import type { Observable } from "../types.js";

/**
 * Once every source has emitted, emits an array of each source's latest value
 * whenever any source emits. Completes when all sources complete.
 *
 * @example
 * combineLatest(width, height).pipeThrough(map(([w, h]) => w * h));
 */
export function combineLatest<T extends readonly unknown[]>(
  ...sources: { [K in keyof T]: Observable<T[K]> }
): Observable<T> {
  return createStream<T>(async (subscriber) => {
    const latest = new Array<unknown>(sources.length);
    const seen = new Array<boolean>(sources.length).fill(false);
    let waitingFor = sources.length;
    await Promise.all(
      sources.map((source, index) =>
        drain(
          source,
          (value) => {
            if (!seen[index]) {
              seen[index] = true;
              waitingFor--;
            }
            latest[index] = value;
            if (waitingFor === 0) subscriber.next([...latest] as unknown as T);
          },
          subscriber.signal,
          () => subscriber.ready(),
        ),
      ),
    );
    subscriber.complete();
  });
}
