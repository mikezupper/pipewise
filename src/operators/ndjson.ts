import { createTransform } from "../internal/transform.js";
import type { Operator } from "../types.js";
import { lines } from "./lines.js";

/**
 * Parses newline-delimited JSON from a stream of text chunks: one value per
 * line, blank lines skipped. A line that is not valid JSON errors the stream
 * with a `SyntaxError` naming the line number.
 *
 * @example
 * response.body.pipeThrough(new TextDecoderStream()).pipeThrough(ndjson<LogEntry>());
 */
export function ndjson<T = unknown>(
  reviver?: (this: unknown, key: string, value: unknown) => unknown,
): Operator<string, T> {
  let lineNumber = 0;
  const parse = createTransform<string, T>({
    transform(line, controller) {
      lineNumber++;
      if (line.trim() === "") return;
      try {
        controller.enqueue(JSON.parse(line, reviver) as T);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new SyntaxError(`Invalid JSON on line ${String(lineNumber)}: ${reason}`, {
          cause: error,
        });
      }
    },
  });
  const split = lines();
  return { writable: split.writable, readable: split.readable.pipeThrough(parse) };
}
