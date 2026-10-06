import { childController } from "./child-signal.js";
import { drain } from "./drain.js";

/** A duration stream being watched for its first value. */
export interface Watch {
  /**
   * Resolves `true` at the stream's first value (the stream is then
   * cancelled), or `false` if it completes, is cancelled, or `parent` aborts
   * first. Rejects if the stream errors.
   */
  readonly fired: Promise<boolean>;
  /** Stops watching and cancels the stream. */
  cancel(): void;
}

/**
 * Watches `stream` for its first value. Timing operators (`audit`, `debounce`,
 * `throttle`, `bufferWhen`, …) use it for their duration and closing streams.
 */
export function watchFirst(stream: ReadableStream<unknown>, parent: AbortSignal): Watch {
  const control = childController(parent);
  let fired = false;
  const done = drain(
    stream,
    () => {
      fired = true;
      control.abort();
    },
    control.signal,
  ).then(() => {
    control.abort();
    return fired;
  });
  return {
    fired: done,
    cancel: () => {
      control.abort();
    },
  };
}
