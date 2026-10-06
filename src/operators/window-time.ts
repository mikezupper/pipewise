import { drain } from "../internal/drain.js";
import { operator } from "../internal/operator.js";
import { createStream } from "../sources/create-stream.js";
import { external, type External } from "../sources/external.js";
import type { Observable, Operator } from "../types.js";

interface OpenWindow<T> {
  readonly window: External<T>;
  seen: number;
  timer?: ReturnType<typeof setTimeout>;
}

/**
 * Splits the source into windows, each a stream lasting `windowTimeSpan` ms.
 * By default a new window opens when the previous closes; with
 * `windowCreationInterval`, one opens every that many ms. A window that
 * reaches `maxWindowSize` values closes early. The first opens immediately.
 *
 * @example
 * events.pipeThrough(windowTime(1000)).pipeThrough(mergeMap((w) => w.pipeThrough(count())));
 */
export function windowTime<T>(
  windowTimeSpan: number,
  windowCreationInterval: number | null = null,
  maxWindowSize: number = Infinity,
): Operator<T, Observable<T>> {
  return operator((source) =>
    createStream<Observable<T>>(async (subscriber) => {
      const open: OpenWindow<T>[] = [];
      const restartOnClose = windowCreationInterval === null || windowCreationInterval < 0;
      let creator: ReturnType<typeof setInterval> | undefined;
      const close = (record: OpenWindow<T>): void => {
        clearTimeout(record.timer);
        open.splice(open.indexOf(record), 1);
        record.window.complete();
        if (restartOnClose) start();
      };
      const start = (): void => {
        if (subscriber.closed) return;
        const record: OpenWindow<T> = { window: external<T>(), seen: 0 };
        open.push(record);
        subscriber.next(record.window.observable);
        record.timer = setTimeout(() => {
          close(record);
        }, windowTimeSpan);
      };
      const end = (finish: (window: External<T>) => void): void => {
        clearInterval(creator);
        for (const record of open.splice(0)) {
          clearTimeout(record.timer);
          finish(record.window);
        }
      };
      subscriber.signal.addEventListener(
        "abort",
        () => {
          end((window) => {
            window.complete();
          });
        },
        { once: true },
      );
      if (!restartOnClose) creator = setInterval(start, windowCreationInterval);
      start();
      try {
        await drain(
          source,
          (value) => {
            for (const record of open.slice()) {
              record.window.next(value);
              if (++record.seen >= maxWindowSize) close(record);
            }
          },
          subscriber.signal,
        );
      } catch (error) {
        end((window) => {
          window.error(error);
        });
        throw error;
      }
      end((window) => {
        window.complete();
      });
      subscriber.complete();
    }),
  );
}
