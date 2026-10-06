import { drain } from "../internal/drain.js";
import { operator } from "../internal/operator.js";
import { Queue } from "../internal/queue.js";
import { createStream } from "../sources/create-stream.js";
import type { Observable, Operator } from "../types.js";

interface Side<T> {
  readonly buffer: Queue<T>;
  done: boolean;
}

/**
 * Emits whether the source and `compareTo` emit equal values in the same
 * order and the same number of them. Answers `false` as soon as they differ,
 * cancelling both. Equality is `===` unless you pass `comparator`, which is
 * always called as `comparator(sourceValue, compareToValue)`. RxJS instead
 * passes the value that arrived last first, so asymmetric comparators can
 * differ.
 *
 * @example
 * entered.pipeThrough(sequenceEqual(of("↑", "↑", "↓", "↓"))); // true for the code
 */
export function sequenceEqual<T>(
  compareTo: Observable<T>,
  comparator: (a: T, b: T) => boolean = (a, b) => a === b,
): Operator<T, boolean> {
  return operator((source) =>
    createStream<boolean>(async (subscriber) => {
      const answer = (equal: boolean): void => {
        subscriber.next(equal);
        subscriber.complete();
      };
      const read = async (
        stream: Observable<T>,
        self: Side<T>,
        other: Side<T>,
        primary: boolean,
      ): Promise<void> => {
        await drain(
          stream,
          (value) => {
            if (other.buffer.length === 0) {
              if (other.done) answer(false);
              else self.buffer.push(value);
            } else {
              const paired = other.buffer.shift() as T;
              if (!(primary ? comparator(value, paired) : comparator(paired, value))) answer(false);
            }
          },
          subscriber.signal,
        );
        self.done = true;
        if (other.done) answer(other.buffer.length === 0 && self.buffer.length === 0);
      };
      const a: Side<T> = { buffer: new Queue<T>(), done: false };
      const b: Side<T> = { buffer: new Queue<T>(), done: false };
      await Promise.all([read(source, a, b, true), read(compareTo, b, a, false)]);
    }),
  );
}
