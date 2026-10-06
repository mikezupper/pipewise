import { drain } from "../internal/drain.js";
import { operator } from "../internal/operator.js";
import { Queue } from "../internal/queue.js";
import { createStream } from "../sources/create-stream.js";
import type { Observable, Operator } from "../types.js";

/**
 * Emits each source value, then projects it to a stream whose values are
 * emitted and projected in turn, recursively. At most `concurrent` projected
 * streams run at once. Completes when the source and every projected stream
 * are done, so `project` must eventually return empty streams.
 *
 * @example
 * of(1).pipeThrough(expand((n) => (n < 8 ? of(n * 2) : empty()))); // 1, 2, 4, 8
 */
export function expand<T>(
  project: (value: T, index: number) => Observable<T>,
  concurrent: number = Infinity,
): Operator<T> {
  if (!(concurrent >= 1)) throw new RangeError("concurrency must be at least 1");
  return operator((source) =>
    createStream<T>(async (subscriber) => {
      const active = new Set<Promise<void>>();
      let wake: (() => void) | undefined;
      const waiting = new Queue<T>();
      let index = 0;
      const start = (value: T): void => {
        let inner: Observable<T>;
        try {
          inner = project(value, index++);
        } catch (reason) {
          subscriber.error(reason);
          return;
        }
        const task: Promise<void> = drain(inner, handle, subscriber.signal, () =>
          subscriber.ready(),
        )
          .catch((error: unknown) => {
            subscriber.error(error);
          })
          .finally(() => {
            active.delete(task);
            if (waiting.length > 0 && !subscriber.closed) start(waiting.shift() as T);
            wake?.();
            wake = undefined;
          });
        active.add(task);
      };
      const handle = (value: T): void => {
        subscriber.next(value);
        if (active.size < concurrent) start(value);
        else waiting.push(value);
      };
      await drain(source, handle, subscriber.signal, () => subscriber.ready());
      while (active.size > 0)
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      subscriber.complete();
    }),
  );
}
