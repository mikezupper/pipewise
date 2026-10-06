import { drain } from "../internal/drain.js";
import type { Observable } from "../types.js";
import { createStream } from "./create-stream.js";

/** `Symbol.dispose` where the runtime has it, without requiring it in type declarations. */
const disposeSymbol: symbol | undefined = (Symbol as { dispose?: symbol }).dispose;

/** Releases `resource` with `[Symbol.dispose]()` or, failing that, `unsubscribe()`. */
function release(resource: unknown): void {
  if (typeof resource !== "object" || resource === null) return;
  const methods = resource as Record<PropertyKey, unknown>;
  const dispose = disposeSymbol ? methods[disposeSymbol] : undefined;
  if (typeof dispose === "function") dispose.call(resource);
  else if (typeof methods.unsubscribe === "function") methods.unsubscribe.call(resource);
}

/**
 * Creates a resource, emits the stream built from it, and releases the
 * resource exactly once when that stream ends for any reason. Release calls
 * the resource's `[Symbol.dispose]()` if it has one, otherwise `unsubscribe()`.
 *
 * @example
 * using(() => openSocket(url), (socket) => fromEvent(socket, "message"));
 */
export function using<T, R>(
  resourceFactory: () => R,
  streamFactory: (resource: R) => Observable<T>,
): Observable<T> {
  return createStream<T>(async (subscriber) => {
    const resource = resourceFactory();
    subscriber.signal.addEventListener(
      "abort",
      () => {
        release(resource);
      },
      { once: true },
    );
    await drain(
      streamFactory(resource),
      (value) => {
        subscriber.next(value);
      },
      subscriber.signal,
      () => subscriber.ready(),
    );
    subscriber.complete();
  });
}
