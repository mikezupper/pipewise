import { collect, fromIterable, toResponse, toSse } from "pipewise";
import { afterEach, describe, expect, it, vi } from "vitest";
import { claudeModel } from "../server/claude-model.mjs";

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A Messages API event stream in the documented shape, as a Response. */
const apiStream = (events) =>
  toResponse(
    fromIterable(events.map((e) => ({ event: e.type, data: JSON.stringify(e) }))).pipeThrough(
      toSse(),
    ),
    {
      headers: { "content-type": "text/event-stream" },
    },
  );

const answer = [
  { type: "message_start", message: { id: "msg_1", type: "message", role: "assistant" } },
  { type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "" } },
  { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "" } },
  { type: "content_block_stop", index: 0 },
  { type: "ping" },
  { type: "content_block_start", index: 1, content_block: { type: "text", text: "" } },
  { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "Hello" } },
  { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: " there" } },
  { type: "content_block_stop", index: 1 },
  { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 2 } },
  { type: "message_stop" },
];

describe("claudeModel()", () => {
  it("sends a streaming request with fallbacks and yields only the text", async () => {
    const fetch = vi.fn(() => Promise.resolve(apiStream(answer)));
    vi.stubGlobal("fetch", fetch);
    const text = await collect(claudeModel({ apiKey: "sk-test" }).stream("hi"));
    expect(text.join("")).toBe("Hello there");
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.headers).toMatchObject({
      "x-api-key": "sk-test",
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "server-side-fallback-2026-07-01",
    });
    expect(JSON.parse(init.body)).toMatchObject({
      model: "claude-opus-5-5",
      stream: true,
      fallbacks: "default",
    });
  });

  it("retries an overloaded connection, then streams", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("overloaded", { status: 529 }))
      .mockResolvedValueOnce(apiStream(answer));
    vi.stubGlobal("fetch", fetch);
    const text = await collect(claudeModel({ apiKey: "k", retryDelay: 0 }).stream("hi"));
    expect(text.join("")).toBe("Hello there");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not retry a client error", async () => {
    const fetch = vi.fn(() => Promise.resolve(new Response("bad key", { status: 401 })));
    vi.stubGlobal("fetch", fetch);
    await expect(collect(claudeModel({ apiKey: "k", retryDelay: 0 }).stream("hi"))).rejects.toThrow(
      /HTTP 401/,
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("turns a mid-stream error event and a refusal into errors", async () => {
    const overloaded = [
      answer[0],
      { type: "error", error: { type: "overloaded_error", message: "Overloaded" } },
    ];
    vi.stubGlobal("fetch", () => Promise.resolve(apiStream(overloaded)));
    await expect(collect(claudeModel({ apiKey: "k" }).stream("hi"))).rejects.toThrow(
      "Claude overloaded_error: Overloaded",
    );
    const refused = [answer[0], { type: "message_delta", delta: { stop_reason: "refusal" } }];
    vi.stubGlobal("fetch", () => Promise.resolve(apiStream(refused)));
    await expect(collect(claudeModel({ apiKey: "k" }).stream("hi"))).rejects.toThrow(/declined/);
  });
});
