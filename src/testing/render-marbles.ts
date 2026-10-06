import { deepEqual } from "./deep-equal.js";
import type { MarbleEvent } from "./parse-marbles.js";

/**
 * Draws events as a marble diagram, the inverse of `parseMarbles()`. A value
 * is drawn as its key in `values`, as itself if it is a one-character string,
 * or as `?`. Silence after the last event is not drawn.
 *
 * @example
 * renderMarbles([{ frame: 1, kind: "next", value: 1 }, { frame: 2, kind: "complete" }], { a: 1 }); // "-a|"
 */
export function renderMarbles(
  events: readonly MarbleEvent[],
  values: Readonly<Record<string, unknown>> = {},
): string {
  const frames = new Map<number, string[]>();
  for (const event of events) {
    const symbol =
      event.kind === "complete"
        ? "|"
        : event.kind === "error"
          ? "#"
          : (Object.keys(values).find((key) => deepEqual(values[key], event.value)) ??
            (typeof event.value === "string" && event.value.length === 1 ? event.value : "?"));
    frames.set(event.frame, [...(frames.get(event.frame) ?? []), symbol]);
  }
  const last = Math.max(-1, ...frames.keys());
  let out = "";
  for (let frame = 0; frame <= last; frame++) {
    const symbols = frames.get(frame);
    out += !symbols ? "-" : symbols.length === 1 ? (symbols[0] ?? "") : `(${symbols.join("")})`;
  }
  return out;
}
