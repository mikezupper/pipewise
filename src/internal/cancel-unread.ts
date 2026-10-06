import { noop } from "./noop.js";

/**
 * Cancels every stream that nobody is reading yet. Operators call this on
 * shutdown so inputs they never got to (a queued `concat` source, an inner
 * stream `exhaustAll` skipped) release their resources too.
 */
export function cancelUnread(streams: Iterable<ReadableStream<unknown>>, reason?: unknown): void {
  for (const stream of streams) {
    if (!stream.locked) stream.cancel(reason).catch(noop);
  }
}
