import type { Observable, QueueOptions } from "../types.js";
import { createStream } from "./create-stream.js";

/** Pass to an `external()` `next` function to complete the stream. */
export const EOF: unique symbol = Symbol("pipewise.EOF");

/** Pushes a value into a stream made with `external()`, or completes it when given `EOF`. */
export type NextFunc<T> = (value: T | typeof EOF) => void;

/** A stream plus the functions that feed it, returned by `external()`. */
export interface External<T> {
  readonly observable: Observable<T>;
  readonly next: NextFunc<T>;
  readonly error: (reason: unknown) => void;
  readonly complete: () => void;
}

/**
 * Creates a stream you feed from outside: call `next(value)` to emit,
 * `next(EOF)` or `complete()` to finish, `error(reason)` to fail.
 * Calls after the stream ends, including after the consumer cancels, are ignored.
 *
 * Values pushed faster than they are read are queued; pass `queue` to bound
 * the queue (see `createStream()`).
 *
 * @example
 * const { observable, next } = external<string>();
 * socket.onmessage = (event) => next(event.data);
 * socket.onclose = () => next(EOF);
 */
export function external<T>(queue?: QueueOptions): External<T> {
  let next!: NextFunc<T>;
  let error!: (reason: unknown) => void;
  let complete!: () => void;
  const observable = createStream<T>((subscriber) => {
    next = (value) => {
      if (value === EOF) subscriber.complete();
      else subscriber.next(value);
    };
    error = (reason) => {
      subscriber.error(reason);
    };
    complete = () => {
      subscriber.complete();
    };
  }, queue);
  return { observable, next, error, complete };
}
