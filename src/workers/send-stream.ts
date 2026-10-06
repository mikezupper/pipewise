import type { Observable, PortLike, TransferList } from "../types.js";
import { noop } from "../internal/noop.js";
import { messageOf, postSafely } from "../internal/port-protocol.js";

/**
 * Sends a stream's values over `port` to a `receiveStream()` on the other
 * side, one value per value the receiver asks for, so backpressure crosses
 * threads. Cancellation from the receiver cancels `stream`; errors are sent
 * across. Resolves when the stream ends. Values must be structured-cloneable;
 * `transfer` moves objects such as `ArrayBuffer`s instead of copying them.
 *
 * @example
 * const { port1, port2 } = new MessageChannel();
 * void sendStream(of(1, 2, 3), port1);
 * receiveStream<number>(port2); // 1, 2, 3
 */
export function sendStream<T>(
  stream: Observable<T>,
  port: PortLike,
  transfer?: TransferList<T>,
): Promise<void> {
  return new Promise((resolve) => {
    const reader = stream.getReader();
    let credits = 0;
    let reading = false;
    let failure: { reason: unknown } | undefined;
    // Read through a function: message handlers change it across awaits.
    const state = { finished: false };
    const isFinished = (): boolean => state.finished;
    const finish = (): void => {
      if (state.finished) return;
      state.finished = true;
      port.removeEventListener("message", onMessage);
      reader.releaseLock();
      port.close?.();
      resolve();
    };
    const fail = (reason: unknown): void => {
      if (state.finished) return;
      reader.cancel(reason).catch(noop);
      postSafely(port, { pw: "error", reason });
      finish();
    };
    const pump = async (): Promise<void> => {
      if (reading) return;
      reading = true;
      try {
        while (credits > 0 && !state.finished) {
          const result = await reader.read();
          if (isFinished()) return;
          if (result.done) {
            postSafely(port, { pw: "done" });
            finish();
            return;
          }
          credits--;
          postSafely(port, { pw: "next", value: result.value }, transfer?.(result.value));
        }
      } catch (error) {
        fail(error);
      } finally {
        reading = false;
        if (failure) fail(failure.reason);
      }
    };
    const onMessage = (event: MessageEvent): void => {
      const message = messageOf(event);
      if (message?.pw === "pull") {
        credits++;
        void pump();
      } else if (message?.pw === "cancel") {
        reader.cancel(message.reason).catch(noop);
        finish();
      }
    };
    port.addEventListener("message", onMessage);
    reader.closed.catch((reason: unknown) => {
      if (reading) failure = { reason };
      else fail(reason);
    });
    port.start?.();
  });
}
