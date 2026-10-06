import { createTransform } from "../internal/transform.js";
import type { Operator } from "../types.js";

/** One Server-Sent Event, as parsed by `sse()`. */
export interface ServerSentEvent {
  /** The event type: `"message"` unless the stream named another. */
  readonly event: string;
  /** The event's data; several `data:` lines are joined with `\n`. */
  readonly data: string;
  /** The last event ID the stream has set, or `""`. */
  readonly id: string;
  /** The reconnection time in ms the stream last set, if any. */
  readonly retry?: number;
}

/**
 * Parses a `text/event-stream` (Server-Sent Events) from text chunks, following
 * the WHATWG rules: `\r`, `\n`, and `\r\n` line endings, even across chunks;
 * `:` comment lines; a leading byte-order mark; multi-line data. An event is
 * emitted at each blank line. A final event without its blank line is
 * discarded, as the specification requires.
 *
 * @example
 * fromFetch("/chat").pipeThrough(responseText()).pipeThrough(sse()); // { event: "message", data: "Hel", id: "" }, …
 */
export function sse(): Operator<string, ServerSentEvent> {
  let line = "";
  let afterCR = false;
  let started = false;
  let data = "";
  let type = "";
  let id = "";
  let retry: number | undefined;

  const field = (text: string): ServerSentEvent | undefined => {
    if (text === "") {
      const event: ServerSentEvent | undefined =
        data === ""
          ? undefined
          : {
              event: type || "message",
              data: data.slice(0, -1),
              id,
              ...(retry === undefined ? {} : { retry }),
            };
      data = "";
      type = "";
      return event;
    }
    if (text.startsWith(":")) return undefined;
    const colon = text.indexOf(":");
    const name = colon < 0 ? text : text.slice(0, colon);
    let value = colon < 0 ? "" : text.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (name === "event") type = value;
    else if (name === "data") data += `${value}\n`;
    else if (name === "id" && !value.includes("\0")) id = value;
    else if (name === "retry" && /^\d+$/.test(value)) retry = Number(value);
    return undefined;
  };

  return createTransform<string, ServerSentEvent>({
    transform(chunk, controller) {
      let text = chunk;
      if (!started && text !== "") {
        started = true;
        if (text.startsWith("﻿")) text = text.slice(1);
      }
      let start = 0;
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (afterCR) {
          afterCR = false;
          if (char === "\n") {
            start = i + 1;
            continue;
          }
        }
        if (char !== "\r" && char !== "\n") continue;
        const event = field(line + text.slice(start, i));
        line = "";
        start = i + 1;
        afterCR = char === "\r";
        if (event) controller.enqueue(event);
      }
      line += text.slice(start);
    },
  });
}
