import type { Observable } from "../types.js";

/**
 * Reads the whole stream and resolves with an array of its values.
 * Rejects if the stream errors.
 *
 * @example
 * await collect(of(1, 2, 3)); // [1, 2, 3]
 */
export async function collect<T>(source: Observable<T>): Promise<T[]> {
  const values: T[] = [];
  await source.pipeTo(
    new WritableStream({
      write(value) {
        values.push(value);
      },
    }),
  );
  return values;
}
