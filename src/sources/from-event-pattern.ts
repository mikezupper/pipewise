import type { Observable, QueueOptions } from "../types.js";
import { createStream } from "./create-stream.js";

/** The handler `fromEventPattern()` registers. */
export type PatternHandler = (...args: unknown[]) => void;

/**
 * Creates a stream from any callback-registration API. `addHandler` is called
 * with a handler; `removeHandler` is called with the same handler, and
 * whatever `addHandler` returned, when the stream is cancelled. A handler
 * called with several arguments emits them as an array. `queue` bounds the
 * queue of unread values.
 *
 * @example
 * fromEventPattern(
 *   (h) => emitter.on("data", h),
 *   (h) => emitter.off("data", h),
 * );
 */
export function fromEventPattern<T>(
  addHandler: (handler: PatternHandler) => unknown,
  removeHandler?: (handler: PatternHandler, token: unknown) => void,
  queue?: QueueOptions,
): Observable<T> {
  return createStream<T>((subscriber) => {
    const handler: PatternHandler = (...args) => {
      subscriber.next((args.length === 1 ? args[0] : args) as T);
    };
    const token = addHandler(handler);
    return () => {
      removeHandler?.(handler, token);
    };
  }, queue);
}
