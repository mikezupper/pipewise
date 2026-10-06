import type { Observable, QueueOptions } from "../types.js";
import { createStream } from "./create-stream.js";

/**
 * Emits every event of type `name` dispatched on `target`.
 * The listener is removed when the stream is cancelled. The stream completes
 * when `options.signal` aborts, or after one event if `options.once` is set.
 * `options.buffer` and `options.overflow` bound the queue of unread events.
 *
 * @example
 * fromEvent<MouseEvent>(button, "click").pipeTo(subscribe(console.log));
 * fromEvent(window, "pointermove", { buffer: 1, overflow: "dropOldest" }); // latest only
 */
export function fromEvent<E extends Event = Event>(
  target: EventTarget,
  name: string,
  options?: AddEventListenerOptions & QueueOptions,
): Observable<E> {
  return createStream<E>((subscriber) => {
    const { signal, buffer, overflow, ...listenerOptions } = options ?? {};
    if (signal?.aborted) {
      subscriber.complete();
      return;
    }
    const listener = (event: Event): void => {
      subscriber.next(event as E);
      if (listenerOptions.once) subscriber.complete();
    };
    const onAbort = (): void => {
      subscriber.complete();
    };
    target.addEventListener(name, listener, listenerOptions);
    signal?.addEventListener("abort", onAbort, { once: true });
    return () => {
      target.removeEventListener(name, listener, listenerOptions);
      signal?.removeEventListener("abort", onAbort);
    };
  }, options);
}
