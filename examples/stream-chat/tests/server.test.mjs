import { collect, map, of, responseText, sse } from "pipewise";
import { describe, expect, it } from "vitest";
import { createApp } from "../server/app.mjs";
import { mockModel } from "../server/mock-model.mjs";

const post = (body) =>
  new Request("http://localhost/chat", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

/** Reads a chat response the way the browser client does. */
const events = (response) => collect(of(response).pipeThrough(responseText()).pipeThrough(sse()));

describe("POST /chat", () => {
  it("streams text events, merged metrics, and a final done event", async () => {
    const app = createApp({ model: mockModel({ delay: 1 }) });
    const response = await app.fetch(post({ prompt: "hello" }));
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    const received = await events(response);
    const text = received
      .filter((e) => e.event === "text")
      .map((e) => e.data)
      .join("");
    expect(text).toMatch(/^You asked: “hello”\. Streams are/);
    expect(received.some((e) => e.event === "metrics" && JSON.parse(e.data).tokens > 0)).toBe(true);
    expect(received.at(-1)?.event).toBe("done");
  });

  it("rejects a missing or empty prompt", async () => {
    const app = createApp({ model: mockModel({ delay: 1 }) });
    expect((await app.fetch(post({}))).status).toBe(400);
    expect((await app.fetch(post({ prompt: "   " }))).status).toBe(400);
  });

  it("turns a model failure into an error event instead of a broken connection", async () => {
    const app = createApp({ model: mockModel({ delay: 1 }) });
    const received = await events(await app.fetch(post({ prompt: "please /fail" })));
    expect(received.at(-1)).toMatchObject({
      event: "error",
      data: "the mock model failed on purpose",
    });
  });

  it("stops the model when the client disconnects", async () => {
    const logs = [];
    const app = createApp({ model: mockModel({ delay: 5, log: (m) => logs.push(m) }) });
    const response = await app.fetch(post({ prompt: "long answer please" }));
    const reader = of(response)
      .pipeThrough(responseText())
      .pipeThrough(sse())
      .pipeThrough(map((e) => e.event))
      .getReader();
    expect((await reader.read()).value).toBe("text");
    await reader.cancel("closed the tab");
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(logs.some((m) => m.startsWith("mock model: stopped after"))).toBe(true);
  });
});

describe("static files", () => {
  it("returns 404 for unknown paths and refuses to leave the served folders", async () => {
    const app = createApp({ model: mockModel() });
    expect((await app.fetch(new Request("http://localhost/nope"))).status).toBe(404);
    expect(
      (await app.fetch(new Request("http://localhost/client/%2e%2e/server/app.mjs"))).status,
    ).toBe(404);
  });
});
