import { afterEach, describe, expect, it, vi } from "vitest";
import {
  collect,
  defer,
  iif,
  from,
  fromFetch,
  map,
  of,
  repeat,
  retry,
  share,
  shareReplay,
  throwError,
} from "../../src/index.js";
import { probe, waitTicks } from "../helpers.js";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("from accepts primitive strings, including Unicode characters", async () => {
  expect(await collect(from("a🌊b"))).toEqual(["a", "🌊", "b"]);
  expect(() => from({} as Iterable<unknown>)).toThrow("from() needs");
});

it("recognizes callable thenables as promises in sources and operators", async () => {
  const promise = Promise.resolve(7);
  const callable = Object.assign(() => undefined, { then: promise.then.bind(promise) });
  expect(await collect(from(callable))).toEqual([7]);
  expect(await collect(of(1).pipeThrough(map(() => callable)))).toEqual([7]);
});

describe.each([share, shareReplay])("multicast reader cleanup", (multicast) => {
  it("releases the source reader after completion and errors", async () => {
    const source = of(1, 2);
    expect(await collect(multicast(source)())).toEqual([1, 2]);
    await waitTicks();
    expect(source.locked).toBe(false);
    const failed = throwError(() => new Error("failed"));
    await expect(collect(multicast(failed)())).rejects.toThrow("failed");
    await waitTicks();
    expect(failed.locked).toBe(false);
  });
});

describe.each(["repeat", "retry"] as const)("%s delayed cleanup", (kind) => {
  it("does not call its factory after cancellation during the delay", async () => {
    vi.useFakeTimers();
    const factory = vi.fn(() => (kind === "repeat" ? of(1) : throwError(() => new Error("retry"))));
    const stream =
      kind === "repeat" ? repeat(factory, { delay: 100 }) : retry(factory, { delay: 100 });
    const reader = stream.getReader();
    const read = reader.read();
    await waitTicks();
    if (kind === "repeat") {
      expect((await read).value).toBe(1);
      void reader.read();
      await waitTicks();
    }
    expect(vi.getTimerCount()).toBe(1);
    await reader.cancel();
    await read;
    await waitTicks();
    expect(factory).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("continues after the delay expires", async () => {
    vi.useFakeTimers();
    let attempts = 0;
    const factory = () =>
      kind === "retry" && attempts++ === 0 ? throwError(() => new Error("retry")) : of(1);
    const result = collect(
      kind === "repeat"
        ? repeat(factory, { count: 2, delay: 100 })
        : retry(factory, { delay: 100 }),
    );
    await waitTicks();
    await vi.advanceTimersByTimeAsync(100);
    expect(await result).toEqual(kind === "repeat" ? [1, 1] : [1]);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("fetch abort subscriptions", () => {
  it.each([true, false])(
    "cancels an unread response body when it arrives before cancellation: %s",
    async (first) => {
      const body = probe<Uint8Array<ArrayBuffer>>();
      let respond!: (response: Response) => void;
      vi.stubGlobal(
        "fetch",
        () =>
          new Promise<Response>((resolve) => {
            respond = resolve;
          }),
      );
      const stream = fromFetch("/test");
      if (first) {
        respond(new Response(body.stream));
        await waitTicks();
      }
      await stream.cancel();
      if (!first) {
        respond(new Response(body.stream));
        await waitTicks();
      }
      expect(body.cancelled).toBe(true);
    },
  );

  it("removes the external abort listener after success or failure", async () => {
    for (const fail of [false, true]) {
      const control = new AbortController();
      const remove = vi.spyOn(control.signal, "removeEventListener");
      vi.stubGlobal("fetch", () =>
        fail ? Promise.reject(new Error("network")) : Promise.resolve(new Response("ok")),
      );
      await collect(fromFetch("/test", { signal: control.signal })).catch(() => undefined);
      expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
    }
  });

  it("follows Request.signal unless init.signal overrides it", async () => {
    const requestControl = new AbortController();
    const request = new Request("https://example.test/", { signal: requestControl.signal });
    let signal: AbortSignal | undefined;
    vi.stubGlobal("fetch", (_: unknown, init: RequestInit) => {
      signal = init.signal ?? undefined;
      return new Promise<Response>(() => undefined);
    });
    const stream = fromFetch(request);
    requestControl.abort("request stopped");
    expect(signal?.reason).toBe("request stopped");
    await stream.cancel();
    const override = new AbortController();
    const second = fromFetch(request, { signal: override.signal });
    expect(signal?.aborted).toBe(false);
    override.abort("override stopped");
    expect(signal?.reason).toBe("override stopped");
    await second.cancel();
  });
});

it("defer releases its inner reader on completion and error", async () => {
  const inner = of(1);
  expect(await collect(defer(() => inner))).toEqual([1]);
  expect(inner.locked).toBe(false);
  const failed = throwError(() => new Error("inner failed"));
  await expect(collect(defer(() => failed))).rejects.toThrow("inner failed");
  expect(failed.locked).toBe(false);
});

it.each(["cancel", "throw"] as const)(
  "iif cancels both inputs when its choice never happens: %s",
  async (exit) => {
    const a = probe<number>();
    const b = probe<number>();
    const condition = vi.fn(() => {
      throw new Error("choice failed");
    });
    const stream = iif(condition, a.stream, b.stream);
    if (exit === "cancel") {
      await stream.cancel();
      expect(condition).not.toHaveBeenCalled();
    } else await expect(collect(stream)).rejects.toThrow("choice failed");
    expect(a.cancelled).toBe(true);
    expect(b.cancelled).toBe(true);
  },
);

it("shareReplay bounds and expires cached values", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1000);
  const source = probe<number>();
  const branch = shareReplay(source.stream, { windowTime: 50, bufferSize: 2 });
  const early = collect(branch());
  source.next(1);
  await waitTicks();
  vi.setSystemTime(1100);
  source.next(2);
  source.next(3);
  source.complete();
  expect(await early).toEqual([1, 2, 3]);
  expect(await collect(branch())).toEqual([2, 3]);
  vi.setSystemTime(1200);
  expect(await collect(branch())).toEqual([]);
  const none = shareReplay(of(1), { bufferSize: 0 });
  await collect(none());
  expect(await collect(none())).toEqual([]);
  expect(() => shareReplay(of(1), { bufferSize: -1 })).toThrow(RangeError);
  expect(() => shareReplay(of(1), { windowTime: NaN })).toThrow(RangeError);
});
