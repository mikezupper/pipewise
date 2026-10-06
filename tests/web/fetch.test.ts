import { afterEach, describe, expect, it, vi } from "vitest";
import {
  collect,
  fromFetch,
  fromIterable,
  HttpError,
  map,
  of,
  responseText,
  sse,
  take,
  toResponse,
  toSse,
} from "../../src/index.js";
import { probe, waitTicks } from "../helpers.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A response whose body is a hand-driven byte stream. */
const streamingResponse = (
  status = 200,
): { response: Response; body: ReturnType<typeof probe<Uint8Array<ArrayBuffer>>> } => {
  const body = probe<Uint8Array<ArrayBuffer>>();
  return { response: new Response(body.stream, { status }), body };
};
const bytes = (text: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(text);

describe("fromFetch()", () => {
  it("emits the response and passes the request options through", async () => {
    const fetch = vi.fn(() => Promise.resolve(new Response("ok")));
    vi.stubGlobal("fetch", fetch);
    const [response] = await collect(fromFetch("/x", { method: "POST" }));
    expect(await response?.text()).toBe("ok");
    expect(fetch).toHaveBeenCalledWith("/x", expect.objectContaining({ method: "POST" }));
  });

  it("aborts the request when cancelled before the response arrives", async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal("fetch", (_: unknown, init: RequestInit) => {
      signal = init.signal ?? undefined;
      return new Promise(() => undefined);
    });
    const stream = fromFetch("/slow");
    await waitTicks();
    await stream.cancel("stop");
    expect(signal?.aborted).toBe(true);
  });

  it("follows init.signal, and does not abort once the response has arrived", async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal("fetch", (_: unknown, init: RequestInit) => {
      signal = init.signal ?? undefined;
      return Promise.resolve(new Response("body"));
    });
    await collect(fromFetch("/x"));
    expect(signal?.aborted).toBe(false);
    const controller = new AbortController();
    vi.stubGlobal("fetch", (_: unknown, init: RequestInit) => {
      signal = init.signal ?? undefined;
      return new Promise(() => undefined);
    });
    void fromFetch("/x", { signal: controller.signal }).getReader().read();
    await waitTicks();
    controller.abort();
    expect(signal?.aborted).toBe(true);
  });
});

describe("responseText()", () => {
  it("decodes the body, including characters split across chunks", async () => {
    const { response, body } = streamingResponse();
    const text = collect(of(response).pipeThrough(responseText()));
    const encoded = bytes("héllo");
    body.next(encoded.slice(0, 2));
    body.next(encoded.slice(2));
    body.complete();
    expect((await text).join("")).toBe("héllo");
  });

  it("errors with HttpError on a non-2xx status unless allowed", async () => {
    const error = await collect(
      of(new Response("nope", { status: 503, statusText: "Busy" })).pipeThrough(responseText()),
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(503);
    const allowed = await collect(
      of(new Response("nope", { status: 503 })).pipeThrough(
        responseText({ allowErrorStatus: true }),
      ),
    );
    expect(allowed.join("")).toBe("nope");
  });

  it("cancelling downstream cancels the body", async () => {
    const { response, body } = streamingResponse();
    const first = collect(of(response).pipeThrough(responseText()).pipeThrough(take(1)));
    await waitTicks();
    body.next(bytes("a"));
    expect(await first).toEqual(["a"]);
    await waitTicks();
    expect(body.cancelled).toBe(true);
  });
});

describe("toResponse()", () => {
  it("encodes strings and passes bytes through", async () => {
    const response = toResponse(fromIterable<string | Uint8Array>(["a", bytes("b"), "é"]), {
      status: 201,
    });
    expect(response.status).toBe(201);
    expect(await response.text()).toBe("abé");
  });

  it("a client disconnect cancels the source stream", async () => {
    const source = probe<string>();
    const response = toResponse(source.stream);
    await response.body?.cancel();
    await waitTicks();
    expect(source.cancelled).toBe(true);
  });
});

describe("server to client over SSE", () => {
  it("streams tokens from an edge handler to a client", async () => {
    const handler = (): Response =>
      toResponse(fromIterable(["Hel", "lo", " world"]).pipeThrough(toSse()), {
        headers: { "content-type": "text/event-stream" },
      });
    vi.stubGlobal("fetch", () => Promise.resolve(handler()));
    const tokens = await collect(
      fromFetch("/chat")
        .pipeThrough(responseText())
        .pipeThrough(sse())
        .pipeThrough(map((event) => event.data)),
    );
    expect(tokens.join("")).toBe("Hello world");
  });
});
