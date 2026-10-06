import { EmptyError } from "../errors.js";
import type { Observable } from "../types.js";

/**
 * Resolves with the stream's first value, then cancels the stream. Rejects
 * with `EmptyError` if it completes first, or with the stream's error.
 *
 * @example
 * const user = await firstValueFrom(userUpdates);
 */
export async function firstValueFrom<T>(source: Observable<T>): Promise<T> {
  const done = new AbortController();
  let first: { value: T } | undefined;
  // Aborting the pipe after the first value cancels the source.
  await source
    .pipeTo(
      new WritableStream({
        write(value) {
          first = { value };
          done.abort();
        },
      }),
      { signal: done.signal },
    )
    .catch((reason: unknown) => {
      if (!first) throw reason;
    });
  if (!first) throw new EmptyError();
  return first.value;
}
