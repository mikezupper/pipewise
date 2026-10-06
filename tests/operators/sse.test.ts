import { describe, expect, it } from "vitest";
import { collect, fromIterable, sse, toSse, type ServerSentEvent } from "../../src/index.js";
import { expectChunkSafe } from "../helpers.js";

const message = (data: string, extra: Partial<ServerSentEvent> = {}): ServerSentEvent => ({
  event: "message",
  data,
  id: "",
  ...extra,
});

describe("sse()", () => {
  it("parses events at blank lines, joining multi-line data", async () => {
    await expectChunkSafe("data: a\n\ndata: b\ndata: c\n\n", sse, [message("a"), message("b\nc")]);
  });

  it("accepts CR, LF, and CRLF line endings, even split across chunks", async () => {
    await expectChunkSafe("data: a\r\rdata: b\r\n\r\ndata: c\n\n", sse, [
      message("a"),
      message("b"),
      message("c"),
    ]);
  });

  it("reads event types and keeps the last id across events", async () => {
    await expectChunkSafe("id: 7\nevent: delta\ndata: x\n\ndata: y\n\n", sse, [
      { event: "delta", data: "x", id: "7" },
      message("y", { id: "7" }),
    ]);
  });

  it("ignores comments, unknown fields, and blocks without data", async () => {
    await expectChunkSafe(": keep-alive\nfoo: bar\nevent: x\n\ndata: a\n\n", sse, [message("a")]);
  });

  it("strips exactly one space after the colon", async () => {
    await expectChunkSafe("data:a\n\ndata:  b\n\ndata\n\n", sse, [
      message("a"),
      message(" b"),
      message(""),
    ]);
  });

  it("skips a leading byte-order mark", async () => {
    await expectChunkSafe("﻿data: a\n\n", sse, [message("a")]);
  });

  it("keeps the last valid retry and ignores ids containing NUL", async () => {
    await expectChunkSafe("retry: 1500\nid: 1\ndata: a\n\nretry: soon\nid: 2\0\ndata: b\n\n", sse, [
      message("a", { id: "1", retry: 1500 }),
      message("b", { id: "1", retry: 1500 }),
    ]);
  });

  it("discards a final event without its blank line", async () => {
    await expectChunkSafe("data: a\n\ndata: unfinished", sse, [message("a")]);
  });
});

describe("toSse()", () => {
  it("encodes strings and events", async () => {
    const text = await collect(
      fromIterable([
        "hi",
        { event: "delta", id: "3", retry: 2000, data: "two\nlines" },
        { event: "message", data: "x" },
      ]).pipeThrough(toSse()),
    );
    expect(text.join("")).toBe(
      "data: hi\n\nretry: 2000\nid: 3\nevent: delta\ndata: two\ndata: lines\n\ndata: x\n\n",
    );
  });

  it("round-trips through sse()", async () => {
    const events: ServerSentEvent[] = [
      message("a"),
      { event: "tool", data: "{\n}", id: "9" },
      message("", { id: "9" }),
    ];
    const parsed = await collect(fromIterable(events).pipeThrough(toSse()).pipeThrough(sse()));
    expect(parsed).toEqual(events);
  });

  it("rejects line breaks in event names and ids", async () => {
    await expect(
      collect(fromIterable([{ data: "x", event: "a\nb" }]).pipeThrough(toSse())),
    ).rejects.toThrow(TypeError);
  });
});
