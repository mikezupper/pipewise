import { drain } from "../internal/drain.js";
import { operator } from "../internal/operator.js";
import { createStream } from "../sources/create-stream.js";
import { external, type External } from "../sources/external.js";
import type { Observable, Operator } from "../types.js";

/**
 * Splits the source into windows of `windowSize` values, each a stream. A new
 * window opens every `startWindowEvery` values (default: `windowSize`), so
 * windows can overlap or skip values. The first window opens immediately.
 *
 * @example
 * of(1, 2, 3, 4).pipeThrough(windowCount(2)); // windows [1, 2], [3, 4], []
 */
export function windowCount<T>(
  windowSize: number,
  startWindowEvery: number = 0,
): Operator<T, Observable<T>> {
  const startEvery = startWindowEvery > 0 ? startWindowEvery : windowSize;
  return operator((source) =>
    createStream<Observable<T>>(async (subscriber) => {
      const windows: External<T>[] = [];
      const openWindow = (): void => {
        const opened = external<T>();
        windows.push(opened);
        subscriber.next(opened.observable);
      };
      subscriber.signal.addEventListener(
        "abort",
        () => {
          for (const open of windows.splice(0)) open.complete();
        },
        { once: true },
      );
      openWindow();
      let count = 0;
      try {
        await drain(
          source,
          (value) => {
            for (const open of windows) open.next(value);
            const closing = count - windowSize + 1;
            if (closing >= 0 && closing % startEvery === 0) windows.shift()?.complete();
            if (++count % startEvery === 0) openWindow();
          },
          subscriber.signal,
        );
      } catch (error) {
        for (const open of windows.splice(0)) open.error(error);
        throw error;
      }
      for (const open of windows.splice(0)) open.complete();
      subscriber.complete();
    }),
  );
}
