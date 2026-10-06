import { createTransform } from "../internal/transform.js";
import { EmptyError, NotFoundError, SequenceError } from "../errors.js";
import type { Operator } from "../types.js";

/**
 * Emits the only value that satisfies `predicate` (or the only value at all)
 * when the source completes. Errors with `SequenceError` as soon as a second
 * match arrives, `NotFoundError` if values arrived but none matched, or
 * `EmptyError` if the source emitted nothing.
 *
 * @example
 * of(42).pipeThrough(single()); // 42
 * of(1, 2, 3).pipeThrough(single((n) => n > 2)); // 3
 */
export function single<T>(predicate?: (value: T, index: number) => boolean): Operator<T> {
  let index = 0;
  let seen = false;
  let found = false;
  let value: T | undefined;
  return createTransform<T, T>({
    transform(chunk) {
      seen = true;
      if (predicate && !predicate(chunk, index++)) return;
      if (found) throw new SequenceError("Too many matching values");
      found = true;
      value = chunk;
    },
    flush(controller) {
      if (!found) throw seen ? new NotFoundError() : new EmptyError();
      controller.enqueue(value);
    },
  });
}
