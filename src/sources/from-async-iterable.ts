import type { Observable } from "../types.js";

/**
 * Emits each value of an async iterable, one per read.
 * Cancelling the stream calls the iterator's `return()`.
 *
 * @example
 * async function* lines() { yield "a"; yield "b"; }
 * fromAsyncIterable(lines());
 */
export function fromAsyncIterable<T>(iterable: AsyncIterable<T>): Observable<T> {
  let iterator: AsyncIterator<T> | undefined;
  return new ReadableStream<T>(
    {
      async pull(controller) {
        iterator ??= iterable[Symbol.asyncIterator]();
        const result = await iterator.next();
        if (result.done) controller.close();
        else controller.enqueue(result.value);
      },
      async cancel() {
        await iterator?.return?.();
      },
    },
    { highWaterMark: 0 },
  );
}
