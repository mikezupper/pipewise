/** One event in a marble diagram, at a frame number. */
export type MarbleEvent =
  | { readonly frame: number; readonly kind: "next"; readonly value: unknown }
  | { readonly frame: number; readonly kind: "complete" }
  | { readonly frame: number; readonly kind: "error"; readonly error: unknown };

/**
 * Parses a marble diagram. Each character is one frame: `-` is time passing,
 * any other character is a value (looked up in `values`, else the character
 * itself), `|` completes, `#` errors with `error`. `(ab)` puts several events
 * in one frame, and the group counts as a single frame. Spaces are ignored.
 *
 * @example
 * parseMarbles("-a-(bc)|", { a: 1, b: 2, c: 3 }); // a@1, b@3, c@3, complete@4
 */
export function parseMarbles(
  marbles: string,
  values: Readonly<Record<string, unknown>> = {},
  error: unknown = new Error("error"),
): MarbleEvent[] {
  const events: MarbleEvent[] = [];
  let frame = 0;
  let inGroup = false;
  for (const char of marbles) {
    if (char === " ") continue;
    if (char === "(") {
      inGroup = true;
      continue;
    }
    if (char === ")") {
      inGroup = false;
      frame++;
      continue;
    }
    if (char === "|") events.push({ frame, kind: "complete" });
    else if (char === "#") events.push({ frame, kind: "error", error });
    else if (char !== "-") {
      events.push({
        frame,
        kind: "next",
        value: Object.hasOwn(values, char) ? values[char] : char,
      });
    }
    if (!inGroup) frame++;
  }
  if (inGroup) throw new SyntaxError(`Unclosed group in marbles "${marbles}"`);
  return events;
}
