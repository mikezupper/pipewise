/**
 * A stream of values over time. pipewise does not wrap streams: an
 * observable is a plain WHATWG `ReadableStream`.
 */
export type Observable<T> = ReadableStream<T>;

/**
 * A step in a pipeline, passed to `ReadableStream.pipeThrough()`.
 * Every `TransformStream<In, Out>` is an `Operator<In, Out>`.
 */
export interface Operator<In, Out = In> {
  readonly writable: WritableStream<In>;
  readonly readable: ReadableStream<Out>;
}

/** Called when a stream ends for any reason: completion, error, or cancellation. */
export type Teardown = () => void;

/**
 * The push side of a stream made with `createStream()`.
 * Calls after the stream has ended are ignored.
 */
export interface Subscriber<T> {
  /** Emits a value. */
  next(value: T): void;
  /** Ends the stream with an error. */
  error(reason: unknown): void;
  /** Ends the stream normally. */
  complete(): void;
  /**
   * Resolves when the consumer is waiting for a value, or when the stream ends.
   * Await it before producing the next value to respect backpressure.
   */
  ready(): Promise<void>;
  /** Aborts when the stream ends for any reason. Pass it to `fetch()`, timers, or listeners. */
  readonly signal: AbortSignal;
  /** `true` once the stream has completed, errored, or been cancelled. */
  readonly closed: boolean;
}

/**
 * Sets up a stream made with `createStream()`. May return a teardown
 * function, or a promise; a rejected promise errors the stream.
 */
export type Producer<T> = (
  subscriber: Subscriber<T>,
  // `void` lets shorthand producers such as `(s) => s.complete()` type-check.
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
) => Teardown | PromiseLike<void> | void;

/**
 * A value, an error, or completion, as a plain object. Produced by
 * `materialize()` and consumed by `dematerialize()`; the shape matches RxJS.
 */
export type Notification<T> =
  | { readonly kind: "N"; readonly value: T }
  | { readonly kind: "E"; readonly error: unknown }
  | { readonly kind: "C" };

/** What a bounded queue does when a value arrives and the queue is full. */
export type OverflowStrategy = "dropOldest" | "dropNewest" | "error";

/**
 * Bounds the queue of a push source: values pushed while nobody is reading
 * wait here. Without `buffer`, the queue is unbounded.
 */
export interface QueueOptions {
  /** Most values to hold for the reader. Defaults to `Infinity`. */
  readonly buffer?: number;
  /**
   * When the queue is full: drop the oldest queued value, drop the new value,
   * or error the stream with `BufferOverflowError`. Defaults to `"error"`.
   */
  readonly overflow?: OverflowStrategy;
}

/**
 * The part of `MessagePort`, `Worker`, and worker global scopes that pipewise
 * uses. Node's `worker_threads` `MessagePort` and `parentPort` qualify too.
 */
export interface PortLike {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  removeEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  start?(): void;
  close?(): void;
}

/** Anything a stage can be sent to: a `Worker`, a `MessagePort`, or Node's `Worker`. */
export interface WorkerLike {
  postMessage(message: unknown, transfer: Transferable[]): void;
}

/** Picks the objects to transfer (move, not copy) along with a value, such as its `ArrayBuffer`. */
export type TransferList<T> = (value: T) => Transferable[];
