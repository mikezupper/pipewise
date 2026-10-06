import { drain } from "../internal/drain.js";
import { operator } from "../internal/operator.js";
import { watchFirst } from "../internal/watch-first.js";
import { createStream } from "../sources/create-stream.js";
import { external, type External } from "../sources/external.js";
import type { Observable, Operator } from "../types.js";

/**
 * Opens a new window, emitted as a stream, each time `openings` emits, and
 * completes it when `closingSelector(openValue)` emits. Windows still open
 * when the source completes are completed then.
 *
 * @example
 * logs.pipeThrough(windowToggle(fromEvent(start, "click"), () => fromEvent(stop, "click")));
 */
export function windowToggle<T, O>(
  openings: Observable<O>,
  closingSelector: (openValue: O) => Observable<unknown>,
): Operator<T, Observable<T>> {
  return operator((source) =>
    createStream<Observable<T>>(async (subscriber) => {
      const windows: External<T>[] = [];
      const fail = (error: unknown): void => {
        for (const open of windows.splice(0)) open.error(error);
        subscriber.error(error);
      };
      subscriber.signal.addEventListener(
        "abort",
        () => {
          for (const open of windows.splice(0)) open.complete();
        },
        { once: true },
      );
      drain(
        openings,
        (openValue) => {
          const closingStream = closingSelector(openValue);
          const opened = external<T>();
          windows.push(opened);
          subscriber.next(opened.observable);
          watchFirst(closingStream, subscriber.signal).fired.then((fired) => {
            const index = windows.indexOf(opened);
            if (!fired || index < 0) return;
            windows.splice(index, 1);
            opened.complete();
          }, fail);
        },
        subscriber.signal,
      ).catch(fail);
      try {
        await drain(
          source,
          (value) => {
            for (const open of windows.slice()) open.next(value);
          },
          subscriber.signal,
        );
      } catch (error) {
        fail(error);
        return;
      }
      for (const open of windows.splice(0)) open.complete();
      subscriber.complete();
    }),
  );
}
