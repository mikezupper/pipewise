import { drain } from "../internal/drain.js";
import { operator } from "../internal/operator.js";
import { createStream } from "../sources/create-stream.js";
import type { Operator } from "../types.js";

/**
 * Calls `f` once when the stream ends for any reason: completion, error, or
 * cancellation by the consumer. Use it to release resources.
 *
 * @example
 * source.pipeThrough(finalize(() => socket.close()));
 */
export function finalize<T>(f: () => void): Operator<T> {
  return operator((source) =>
    createStream<T>(async (subscriber) => {
      subscriber.signal.addEventListener("abort", f, { once: true });
      await drain(
        source,
        (value) => {
          subscriber.next(value);
        },
        subscriber.signal,
        () => subscriber.ready(),
      );
      subscriber.complete();
    }),
  );
}
