import { createTransform } from "../internal/transform.js";
import type { Operator } from "../types.js";

/** What `toSse()` encodes: a string (sent as data) or an event's fields. */
export type SseInput =
  | string
  | {
      readonly data: string;
      readonly event?: string;
      readonly id?: string;
      readonly retry?: number;
    };

const unsafe = /[\r\n\0]/;

/**
 * Encodes values as a `text/event-stream` for a server response. A string is
 * sent as an event's data; an object may also set `event`, `id`, and `retry`.
 * Multi-line data becomes several `data:` lines. An `event` or `id` containing
 * a line break errors the stream.
 *
 * @example
 * toResponse(tokens.pipeThrough(toSse()), { headers: { "content-type": "text/event-stream" } });
 */
export function toSse(): Operator<SseInput, string> {
  return createTransform<SseInput, string>({
    transform(input, controller) {
      const { data, event, id, retry } = typeof input === "string" ? { data: input } : input;
      if ((event !== undefined && unsafe.test(event)) || (id !== undefined && unsafe.test(id))) {
        throw new TypeError("SSE event and id must not contain line breaks or NUL");
      }
      let out = "";
      if (retry !== undefined) out += `retry: ${String(Math.max(0, Math.floor(retry)))}\n`;
      if (id !== undefined) out += `id: ${id}\n`;
      if (event !== undefined && event !== "message") out += `event: ${event}\n`;
      for (const line of data.split(/\r\n|\r|\n/)) out += `data: ${line}\n`;
      controller.enqueue(`${out}\n`);
    },
  });
}
