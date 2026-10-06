import { discardValue } from "../internal/cancel-stream.js";
import { drain } from "../internal/drain.js";
import { operator } from "../internal/operator.js";
import { createStream } from "../sources/create-stream.js";
import type { Observable, Operator } from "../types.js";

/** Options for `exhaustMap()`. */
export interface ExhaustMapOptions<In> {
  /**
   * Called synchronously for each value ignored because an inner stream is
   * still active, with the value's position in the source. `project` is never
   * called for it, and a dropped value that is itself a stream is cancelled.
   */
  readonly onDrop?: (value: In, index: number) => void;
}

/**
 * Maps a value to a stream and emits from it, ignoring values that arrive
 * while that stream is still active. Ignored values are never projected, so
 * their work never starts; `onDrop` reports them.
 *
 * @example
 * submitClicks.pipeThrough(exhaustMap(() => fromFetch("/save", { method: "POST" }), {
 *   onDrop: () => console.log("save already in progress"),
 * }));
 */
export function exhaustMap<In, Out>(
  project: (value: In, index: number) => Observable<Out>,
  options: ExhaustMapOptions<In> = {},
): Operator<In, Out> {
  const { onDrop } = options;
  return operator<In, Out>(
    (source) =>
      createStream<Out>(async (subscriber) => {
        let active: Promise<void> | undefined;
        let position = 0;
        let index = 0;
        await drain(
          source,
          (value) => {
            const at = position++;
            if (active) {
              discardValue(value);
              onDrop?.(value, at);
              return;
            }
            active = drain(
              project(value, index++),
              (inner) => {
                subscriber.next(inner);
              },
              subscriber.signal,
              () => subscriber.ready(),
            ).then(
              () => {
                active = undefined;
              },
              (error: unknown) => {
                subscriber.error(error);
              },
            );
          },
          subscriber.signal,
          undefined,
          discardValue,
        );
        await active;
        subscriber.complete();
      }),
    discardValue,
  );
}
