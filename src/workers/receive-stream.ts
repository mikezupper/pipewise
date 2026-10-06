import type { Observable, PortLike } from "../types.js";
import { messageOf, postSafely } from "../internal/port-protocol.js";

/**
 * Receives a stream sent with `sendStream()` from the other end of a
 * `MessagePort`. Each read asks the sender for one value. Cancelling this
 * stream cancels the sender's stream; the sender's errors arrive here.
 *
 * @example
 * // In a worker: receiveStream<LogLine>(port).pipeThrough(filter(isError));
 * receiveStream<number>(port);
 */
export function receiveStream<T>(port: PortLike): Observable<T> {
  let controller!: ReadableStreamDefaultController<T>;
  let done = false;
  const stop = (): void => {
    if (done) return;
    done = true;
    port.removeEventListener("message", onMessage);
    port.close?.();
  };
  const onMessage = (event: MessageEvent): void => {
    const message = messageOf(event);
    if (!message || done) return;
    if (message.pw === "next") controller.enqueue(message.value as T);
    else if (message.pw === "done") {
      stop();
      controller.close();
    } else if (message.pw === "error") {
      stop();
      controller.error(message.reason);
    }
  };
  return new ReadableStream<T>(
    {
      start(c) {
        controller = c;
        port.addEventListener("message", onMessage);
        port.start?.();
      },
      pull() {
        port.postMessage({ pw: "pull" });
      },
      cancel(reason) {
        if (done) return;
        postSafely(port, { pw: "cancel", reason });
        stop();
      },
    },
    { highWaterMark: 0 },
  );
}
