import { createTransform } from "../internal/transform.js";
import type { Operator } from "../types.js";

/**
 * Splits a stream of text chunks on `separator`, emitting each piece. Pieces
 * may span chunk boundaries. The text after the last separator is emitted
 * when the source completes, unless it is empty.
 *
 * @example
 * of("a,b", ",c").pipeThrough(split(",")); // "a", "b", "c"
 */
export function split(separator: string): Operator<string> {
  if (separator === "") throw new RangeError("split separator must not be empty");
  let rest = "";
  return createTransform<string, string>({
    transform(chunk, controller) {
      const pieces = (rest + chunk).split(separator);
      rest = pieces.pop() ?? "";
      for (const piece of pieces) controller.enqueue(piece);
    },
    flush(controller) {
      if (rest !== "") controller.enqueue(rest);
    },
  });
}
