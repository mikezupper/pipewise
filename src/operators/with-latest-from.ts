import { drain } from "../internal/drain.js";
import { operator } from "../internal/operator.js";
import { createStream } from "../sources/create-stream.js";
import type { Observable, Operator } from "../types.js";

/**
 * Pairs each source value with the latest value of every stream in `others`,
 * as `[value, ...latest]`. Source values arriving before every other stream
 * has emitted are dropped. Only the source's completion ends the output.
 *
 * @example
 * clicks.pipeThrough(withLatestFrom(mousePosition)); // [click, position]
 */
export function withLatestFrom<T, U extends readonly unknown[]>(
  ...others: { [K in keyof U]: Observable<U[K]> }
): Operator<T, [T, ...U]> {
  return operator((source) =>
    createStream<[T, ...U]>(async (subscriber) => {
      const latest = new Array<unknown>(others.length);
      const seen = new Array<boolean>(others.length).fill(false);
      let waitingFor = others.length;
      others.forEach((other, index) => {
        drain(
          other,
          (value) => {
            latest[index] = value;
            if (seen[index]) return;
            seen[index] = true;
            waitingFor--;
          },
          subscriber.signal,
        ).catch((error: unknown) => {
          subscriber.error(error);
        });
      });
      await drain(
        source,
        (value) => {
          if (waitingFor === 0) subscriber.next([value, ...latest] as [T, ...U]);
        },
        subscriber.signal,
        () => subscriber.ready(),
      );
      subscriber.complete();
    }),
  );
}
