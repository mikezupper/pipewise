import { noop } from "../internal/noop.js";
import type { Observable, Subscriber } from "../types.js";
import { createStream } from "./create-stream.js";

/** Options for `shareReplay()`. */
export interface ShareReplayOptions {
  /** How many recent values to replay to a new branch. Defaults to `Infinity`. */
  readonly bufferSize?: number;
  /** Only replay values younger than this many ms. Defaults to `Infinity`. */
  readonly windowTime?: number;
  /**
   * Cancel the source when every branch is gone. Defaults to `false`, as in
   * RxJS: the source keeps running, and filling the replay buffer, with no branches.
   */
  readonly refCount?: boolean;
}

type Ending = { readonly error: false } | { readonly error: true; readonly reason: unknown };

/**
 * Like `share()`, but each new branch first receives the most recent values,
 * and branches created after the source ends replay them and then end the same way.
 * A negative or `NaN` `bufferSize` or `windowTime` throws a `RangeError`, where
 * RxJS silently clamps it.
 *
 * @example
 * const config = shareReplay(fromAsyncFunction(loadConfig), { bufferSize: 1 });
 * await firstValueFrom(config()); // loads once
 * await firstValueFrom(config()); // replays
 */
export function shareReplay<T>(
  source: Observable<T>,
  options: ShareReplayOptions = {},
): () => Observable<T> {
  const { bufferSize = Infinity, windowTime = Infinity, refCount = false } = options;
  if (!(bufferSize >= 0 && windowTime >= 0))
    throw new RangeError("replay limits must be 0 or more");
  const replay = new Map<number, { value: T; at: number }>();
  let sequence = 0;
  const branches = new Set<Subscriber<T>>();
  let reader: ReadableStreamDefaultReader<T> | undefined;
  let ended: Ending | undefined;

  const trim = (): void => {
    const cutoff = Date.now() - windowTime;
    for (const [key, entry] of replay) {
      if (replay.size <= bufferSize && entry.at >= cutoff) break;
      replay.delete(key);
    }
  };
  const finish = (subscriber: Subscriber<T>, ending: Ending): void => {
    if (ending.error) subscriber.error(ending.reason);
    else subscriber.complete();
  };

  const pump = async (active: ReadableStreamDefaultReader<T>): Promise<void> => {
    try {
      for (;;) {
        if (branches.size > 0) await Promise.all([...branches].map((branch) => branch.ready()));
        if (ended) return;
        const result = await active.read();
        if (result.done) {
          ended = { error: false };
          break;
        }
        replay.set(sequence++, { value: result.value, at: Date.now() });
        trim();
        for (const branch of branches) branch.next(result.value);
      }
    } catch (reason) {
      ended = { error: true, reason };
    } finally {
      active.releaseLock();
    }
    for (const branch of branches) finish(branch, ended);
  };

  return () =>
    createStream<T>((subscriber) => {
      trim();
      for (const entry of replay.values()) subscriber.next(entry.value);
      if (ended) {
        finish(subscriber, ended);
        return;
      }
      branches.add(subscriber);
      if (!reader) {
        reader = source.getReader();
        void pump(reader);
      }
      return () => {
        branches.delete(subscriber);
        if (refCount && branches.size === 0 && !ended) {
          ended = { error: false };
          reader?.cancel().catch(noop);
        }
      };
    });
}
