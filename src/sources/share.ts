import { noop } from "../internal/noop.js";
import type { Observable, Subscriber } from "../types.js";
import { createStream } from "./create-stream.js";

/**
 * Lets several consumers read one stream. Returns a function; each call
 * returns a new branch that receives every value the source emits from then on.
 *
 * - The source is read only as fast as the slowest branch, so nothing is
 *   buffered without limit (unlike `ReadableStream.tee()`).
 * - Reading starts with the first branch. When every branch is cancelled,
 *   the source is cancelled; later branches complete immediately.
 *
 * @example
 * const branch = share(fromEvent(socket, "message"));
 * branch().pipeTo(subscribe(log));
 * branch().pipeThrough(filter(isAlert)).pipeTo(subscribe(notify));
 */
export function share<T>(source: Observable<T>): () => Observable<T> {
  const branches = new Set<Subscriber<T>>();
  let reader: ReadableStreamDefaultReader<T> | undefined;
  let ended: { readonly error: boolean; readonly reason?: unknown } | undefined;

  const pump = async (): Promise<void> => {
    const active = source.getReader();
    reader = active;
    try {
      while (branches.size > 0) {
        await Promise.all([...branches].map((branch) => branch.ready()));
        if (branches.size === 0) break;
        const result = await active.read();
        if (result.done) {
          ended = { error: false };
          for (const branch of branches) branch.complete();
          return;
        }
        for (const branch of branches) branch.next(result.value);
      }
      ended = { error: false };
      await active.cancel().catch(noop);
    } catch (reason) {
      ended = { error: true, reason };
      for (const branch of branches) branch.error(reason);
    } finally {
      active.releaseLock();
    }
  };

  return () =>
    createStream<T>((subscriber) => {
      if (ended) {
        if (ended.error) subscriber.error(ended.reason);
        else subscriber.complete();
        return;
      }
      branches.add(subscriber);
      if (!reader) void pump();
      return () => {
        branches.delete(subscriber);
        if (branches.size === 0 && !ended) {
          ended = { error: false };
          reader?.cancel().catch(noop);
        }
      };
    });
}
