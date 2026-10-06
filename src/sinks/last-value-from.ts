import { EmptyError } from "../errors.js";
import type { Observable } from "../types.js";

/**
 * Reads the whole stream and resolves with its last value. Rejects with
 * `EmptyError` if there is none, or with the stream's error.
 *
 * @example
 * const total = await lastValueFrom(prices.pipeThrough(reduce(add, 0)));
 */
export async function lastValueFrom<T>(source: Observable<T>): Promise<T> {
  let last: { value: T } | undefined;
  await source.pipeTo(
    new WritableStream({
      write(value) {
        last = { value };
      },
    }),
  );
  if (!last) throw new EmptyError();
  return last.value;
}
