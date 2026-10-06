import { drain } from "../internal/drain.js";
import { operator } from "../internal/operator.js";
import { createStream } from "../sources/create-stream.js";
import type { Operator } from "../types.js";

/**
 * Emits a value only after `ms` milliseconds pass without another value.
 * A pending value is emitted immediately when the source completes.
 *
 * @example
 * searchInput.pipeThrough(debounceTime(300));
 */
export function debounceTime<T>(ms: number): Operator<T> {
  return operator((source) =>
    createStream<T>(async (subscriber) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      let pending: { value: T } | undefined;
      const emit = (): void => {
        clearTimeout(timer);
        timer = undefined;
        if (!pending) return;
        const { value } = pending;
        pending = undefined;
        subscriber.next(value);
      };
      subscriber.signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
        },
        { once: true },
      );
      await drain(
        source,
        (value) => {
          pending = { value };
          clearTimeout(timer);
          timer = setTimeout(emit, ms);
        },
        subscriber.signal,
      );
      emit();
      subscriber.complete();
    }),
  );
}
