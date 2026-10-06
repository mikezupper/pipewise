import { isPromiseLike } from "./is-promise-like.js";
import { noop } from "./noop.js";

/**
 * Reads `stream` to the end, passing each value to `onValue`.
 *
 * - Cancels `stream` and returns early when `signal` aborts.
 * - Waits for `ready()` before each read, so a slow consumer slows the producer.
 * - Rejects if `stream` errors or `onValue` throws; in the latter case `stream`
 *   is cancelled first.
 * - Passes a value read just as `signal` aborts to `discard` instead of dropping it.
 * - Rejects as soon as `stream` errors, even while an async `onValue` is still
 *   busy, so operators that pause reading (concatMap, responseText) still
 *   report source errors immediately.
 *
 * Every operator that reads more than one stream is built on this, so
 * cancellation and error propagation behave the same everywhere.
 */
/** Reads `signal.aborted` without TypeScript narrowing it across awaits. */
function isAborted(signal: AbortSignal): boolean {
  return signal.aborted;
}

export async function drain<T>(
  stream: ReadableStream<T>,
  onValue: (value: T) => unknown,
  signal: AbortSignal,
  ready?: () => Promise<void>,
  discard?: (value: T) => void,
): Promise<void> {
  const reader = stream.getReader();
  let pending: { resolve: () => void; reject: (reason: unknown) => void } | undefined;
  let failure: { reason: unknown } | undefined;
  const cancel = (): void => {
    reader.cancel(signal.reason).catch(noop);
    pending?.resolve();
  };
  if (signal.aborted) {
    cancel();
    reader.releaseLock();
    return;
  }
  signal.addEventListener("abort", cancel, { once: true });
  // One error observer per reader, rather than one retained race reaction per value.
  reader.closed.catch((reason: unknown) => {
    failure = { reason };
    pending?.reject(reason);
  });
  const wait = (work: PromiseLike<unknown>): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      Promise.resolve(work).then(() => {
        resolve();
      }, reject);
      pending = { resolve, reject };
      if (failure) {
        // Stream errors may be any value; preserve the original reason.
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        reject(failure.reason);
      } else if (signal.aborted) resolve();
    });
  try {
    for (;;) {
      if (ready) await wait(ready());
      // `signal` can abort during any await, so re-check it after each one.
      if (isAborted(signal)) return;
      const result = await reader.read();
      if (result.done) return;
      if (isAborted(signal)) {
        discard?.(result.value);
        return;
      }
      const work = onValue(result.value);
      if (isPromiseLike(work)) await wait(work);
    }
  } catch (error) {
    await reader.cancel(error).catch(noop);
    throw error;
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}
