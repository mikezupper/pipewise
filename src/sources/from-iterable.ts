import type { Observable } from "../types.js";

/**
 * Emits each value of a synchronous iterable, one per read.
 * Values are produced only as the consumer asks for them, so infinite
 * generators are safe. Cancelling the stream calls the iterator's `return()`,
 * which runs a generator's `finally` blocks.
 *
 * @example
 * fromIterable([1, 2, 3]);
 */
export function fromIterable<T>(iterable: Iterable<T>): Observable<T> {
  let iterator: Iterator<T> | undefined;
  return new ReadableStream<T>(
    {
      pull(controller) {
        iterator ??= iterable[Symbol.iterator]();
        const result = iterator.next();
        if (result.done) controller.close();
        else controller.enqueue(result.value);
      },
      cancel() {
        iterator?.return?.();
      },
    },
    { highWaterMark: 0 },
  );
}
