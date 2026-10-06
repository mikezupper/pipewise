import { createTransform } from "../internal/transform.js";
import type { Operator } from "../types.js";

/**
 * Splits a stream of text chunks into lines, accepting `\n` and `\r\n` line
 * endings even when they straddle chunks. Line endings are removed. A final
 * line without an ending is emitted when the source completes.
 *
 * @example
 * response.body.pipeThrough(new TextDecoderStream()).pipeThrough(lines());
 */
export function lines(): Operator<string> {
  let rest = "";
  const strip = (line: string): string => (line.endsWith("\r") ? line.slice(0, -1) : line);
  return createTransform<string, string>({
    transform(chunk, controller) {
      const pieces = (rest + chunk).split("\n");
      rest = pieces.pop() ?? "";
      for (const piece of pieces) controller.enqueue(strip(piece));
    },
    flush(controller) {
      if (rest !== "") controller.enqueue(strip(rest));
    },
  });
}
