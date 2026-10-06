import { drain } from "../internal/drain.js";
import { operator } from "../internal/operator.js";
import { createStream } from "../sources/create-stream.js";
import type { Notification, Operator } from "../types.js";

/**
 * Turns each value, and the final completion or error, into a `Notification`
 * object. The output always completes normally.
 *
 * @example
 * risky.pipeThrough(materialize()); // { kind: "N", value }, …, { kind: "E", error }
 */
export function materialize<T>(): Operator<T, Notification<T>> {
  return operator((source) =>
    createStream<Notification<T>>(async (subscriber) => {
      try {
        await drain(
          source,
          (value) => {
            subscriber.next({ kind: "N", value });
          },
          subscriber.signal,
          () => subscriber.ready(),
        );
        subscriber.next({ kind: "C" });
      } catch (error) {
        subscriber.next({ kind: "E", error });
      }
      subscriber.complete();
    }),
  );
}
