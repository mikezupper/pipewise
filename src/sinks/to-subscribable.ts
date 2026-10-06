import { noop } from "../internal/noop.js";
import { reportError } from "../internal/report-error.js";
import type { Observable } from "../types.js";

/** Callbacks accepted by `subscribe()` on the result of `toSubscribable()`. */
export interface PartialObserver<T> {
  readonly next?: (value: T) => void;
  readonly error?: (reason: unknown) => void;
  readonly complete?: () => void;
}

/** A subscription returned by `toSubscribable().subscribe()`. */
export interface Subscription {
  unsubscribe(): void;
  readonly closed: boolean;
}

/** An Observable-shaped object that RxJS's `from()` and similar libraries accept. */
export interface InteropObservable<T> {
  subscribe(observer?: PartialObserver<T> | ((value: T) => void)): Subscription;
  /** Lets libraries that look for `Symbol.observable` find this object. */
  "@@observable"(): InteropObservable<T>;
}

/** `Symbol.observable` if a polyfill defined it; RxJS falls back to the same string. */
const observableKey: string | symbol =
  (Symbol as { observable?: symbol }).observable ?? "@@observable";

/**
 * Wraps a stream in the Observable `subscribe()` protocol, for libraries that
 * consume it: Svelte stores, `zen-observable`, the TC39 `Observable.from()`.
 * `subscribe()` reads the stream and `unsubscribe()` cancels it. A stream can
 * be read once, so pass a factory to allow several subscribers, each with a
 * fresh stream. An exception thrown by an observer callback is reported, not
 * sent to `error`.
 *
 * RxJS needs no wrapper: its `from()` accepts a `ReadableStream` directly.
 *
 * @example
 * // A Svelte store: `$clicks` in a component re-renders on every click.
 * export const clicks = toSubscribable(() => fromEvent(button, "click"));
 */
export function toSubscribable<T>(
  source: Observable<T> | (() => Observable<T>),
): InteropObservable<T> {
  let used = false;
  const interop: InteropObservable<T> = {
    subscribe(observerOrNext = {}) {
      const observer =
        typeof observerOrNext === "function" ? { next: observerOrNext } : observerOrNext;
      // A property, not a local, because callbacks change it across awaits.
      const state: { closed: boolean; reader?: ReadableStreamDefaultReader<T> } = { closed: false };
      const call = (f: () => void): void => {
        try {
          f();
        } catch (error) {
          reportError(error);
        }
      };
      const subscription: Subscription = {
        unsubscribe() {
          if (state.closed) return;
          state.closed = true;
          state.reader?.cancel().catch(noop);
        },
        get closed() {
          return state.closed;
        },
      };
      if (typeof source !== "function" && used) {
        state.closed = true;
        const reason = new Error(
          "toSubscribable: this stream was already subscribed; pass a factory instead",
        );
        call(() => observer.error?.(reason));
        return subscription;
      }
      used = true;
      const active = (typeof source === "function" ? source() : source).getReader();
      state.reader = active;
      void (async () => {
        try {
          for (;;) {
            const result = await active.read();
            if (state.closed) return;
            if (result.done) break;
            call(() => observer.next?.(result.value));
          }
          state.closed = true;
          call(() => observer.complete?.());
        } catch (error) {
          if (state.closed) return;
          state.closed = true;
          if (observer.error) call(() => observer.error?.(error));
          else reportError(error);
        } finally {
          active.releaseLock();
        }
      })();
      return subscription;
    },
    "@@observable": () => interop,
  };
  if (observableKey !== "@@observable")
    Object.defineProperty(interop, observableKey, { value: () => interop });
  return interop;
}
