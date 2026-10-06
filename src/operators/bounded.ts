import { drain } from "../internal/drain.js";
import { operator } from "../internal/operator.js";
import { createStream } from "../sources/create-stream.js";
import type { Operator, OverflowStrategy } from "../types.js";

/**
 * Reads the source as fast as it produces and holds at most `buffer` values
 * for the reader. When full, drops the oldest value, drops the new one, or
 * errors with `BufferOverflowError`. Use it to put a memory bound on a source
 * that cannot be slowed down, such as a third-party event stream.
 *
 * @example
 * prices.pipeThrough(bounded(1, "dropOldest")); // the reader always sees the latest price
 */
export function bounded<T>(buffer: number, overflow: OverflowStrategy = "error"): Operator<T> {
  return operator((source) =>
    createStream<T>(
      async (subscriber) => {
        await drain(
          source,
          (value) => {
            subscriber.next(value);
          },
          subscriber.signal,
        );
        subscriber.complete();
      },
      { buffer, overflow },
    ),
  );
}
