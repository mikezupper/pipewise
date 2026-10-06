import type { Observable, QueueOptions } from "../types.js";
import { createStream } from "./create-stream.js";

/** Anything with an RxJS-style or TC39-style `subscribe` method. */
export interface Subscribable<T> {
  subscribe(observer: {
    next: (value: T) => void;
    error: (reason: unknown) => void;
    complete: () => void;
  }): { unsubscribe(): void } | (() => void) | undefined;
}

/**
 * Adapts an RxJS `Observable`, a TC39 `Observable`, or anything else with a
 * `subscribe({ next, error, complete })` method. Cancelling the stream
 * unsubscribes. Values pushed faster than they are read are queued; `queue`
 * bounds the queue.
 *
 * @example
 * import { interval as rxInterval } from "rxjs";
 * fromSubscribable(rxInterval(1000)).pipeThrough(take(3));
 */
export function fromSubscribable<T>(
  subscribable: Subscribable<T>,
  queue?: QueueOptions,
): Observable<T> {
  return createStream<T>((subscriber) => {
    const subscription = subscribable.subscribe({
      next: (value) => {
        subscriber.next(value);
      },
      error: (reason) => {
        subscriber.error(reason);
      },
      complete: () => {
        subscriber.complete();
      },
    });
    return () => {
      if (typeof subscription === "function") subscription();
      else subscription?.unsubscribe();
    };
  }, queue);
}
