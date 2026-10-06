import type { Observable } from "../types.js";
import { noop } from "./noop.js";

/** Opens a reader on first demand, releasing it on every exit path. */
export function lazyStream<T>(
  factory: () => Observable<T>,
  cancelUnread?: () => void,
): Observable<T> {
  let reader: ReadableStreamDefaultReader<T> | undefined;
  return new ReadableStream<T>(
    {
      async pull(controller) {
        try {
          reader ??= factory().getReader();
          const result = await reader.read();
          if (result.done) {
            reader.releaseLock();
            controller.close();
          } else controller.enqueue(result.value);
        } catch (reason) {
          reader?.releaseLock();
          throw reason;
        }
      },
      async cancel(reason) {
        try {
          cancelUnread?.();
          await reader?.cancel(reason).catch(noop);
        } finally {
          reader?.releaseLock();
        }
      },
    },
    { highWaterMark: 0 },
  );
}
