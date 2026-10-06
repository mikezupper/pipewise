import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bounded,
  BufferOverflowError,
  collect,
  createStream,
  external,
  fromEvent,
  interval,
  take,
} from "../../src/index.js";
import { probe, waitTicks } from "../helpers.js";

/** Pushes 1..n with nobody reading, then reads everything that was kept. */
async function pushThenRead(options: Parameters<typeof external>[0], n = 5): Promise<number[]> {
  const { observable, next, complete } = external<number>(options);
  for (let i = 1; i <= n; i++) next(i);
  complete();
  return collect(observable);
}

describe("bounded push sources", () => {
  it("are unbounded by default", async () => {
    expect(await pushThenRead(undefined)).toEqual([1, 2, 3, 4, 5]);
  });

  it("dropOldest keeps the newest values", async () => {
    expect(await pushThenRead({ buffer: 2, overflow: "dropOldest" })).toEqual([4, 5]);
  });

  it("dropNewest keeps the oldest values", async () => {
    expect(await pushThenRead({ buffer: 2, overflow: "dropNewest" })).toEqual([1, 2]);
  });

  it("error delivers what fit, then errors with BufferOverflowError", async () => {
    const { observable, next } = external<number>({ buffer: 2 });
    for (let i = 1; i <= 3; i++) next(i);
    const reader = observable.getReader();
    expect((await reader.read()).value).toBe(1);
    expect((await reader.read()).value).toBe(2);
    await expect(reader.read()).rejects.toBeInstanceOf(BufferOverflowError);
  });

  it("buffer 0 delivers only to a reader already waiting", async () => {
    const { observable, next, complete } = external<number>({ buffer: 0, overflow: "dropNewest" });
    const reader = observable.getReader();
    const first = reader.read();
    // A read registers as demand once the stream has started, a microtask later.
    await waitTicks();
    next(1);
    next(2);
    complete();
    expect((await first).value).toBe(1);
    expect((await reader.read()).done).toBe(true);
  });

  it("rejects a negative buffer", () => {
    expect(() => createStream(() => undefined, { buffer: -1 })).toThrow(RangeError);
  });

  it("keeps memory bounded when the reader never catches up", async () => {
    const { observable, next, complete } = external<number>({ buffer: 3, overflow: "dropOldest" });
    for (let i = 0; i < 100_000; i++) next(i);
    complete();
    expect(await collect(observable)).toEqual([99_997, 99_998, 99_999]);
  });
});

describe("queue options on sources", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fromEvent passes buffer options to the queue, not to addEventListener", async () => {
    const target = new EventTarget();
    const added = vi.spyOn(target, "addEventListener");
    const stream = fromEvent(target, "ping", { buffer: 1, overflow: "dropOldest", passive: true });
    expect(added.mock.calls[0]?.[2]).toEqual({ passive: true });
    for (const n of [1, 2, 3]) target.dispatchEvent(new CustomEvent("ping", { detail: n }));
    const reader = stream.getReader();
    expect(((await reader.read()).value as CustomEvent<number>).detail).toBe(3);
  });

  it("interval keeps only the latest tick with buffer 1", async () => {
    const reader = interval(10, { buffer: 1, overflow: "dropOldest" }).getReader();
    await vi.advanceTimersByTimeAsync(55);
    expect((await reader.read()).value).toBe(4);
    await reader.cancel();
  });
});

describe("bounded()", () => {
  it("reads eagerly and keeps the latest values", async () => {
    const source = probe<number>();
    const reader = source.stream.pipeThrough(bounded(2, "dropOldest")).getReader();
    for (const n of [1, 2, 3, 4]) source.next(n);
    await waitTicks();
    source.complete();
    const seen: number[] = [];
    for (let r = await reader.read(); !r.done; r = await reader.read()) seen.push(r.value);
    expect(seen).toEqual([3, 4]);
  });

  it("errors on overflow by default and cancels the source", async () => {
    const source = probe<number>();
    const reader = source.stream.pipeThrough(bounded(1)).getReader();
    source.next(1);
    source.next(2);
    await waitTicks();
    expect((await reader.read()).value).toBe(1);
    await expect(reader.read()).rejects.toBeInstanceOf(BufferOverflowError);
    await waitTicks();
    expect(source.cancelled).toBe(true);
  });

  it("passes values through when the reader keeps up", async () => {
    const { observable, next, complete } = external<number>();
    const result = collect(observable.pipeThrough(bounded(1)).pipeThrough(take(3)));
    for (const n of [1, 2, 3]) {
      next(n);
      await waitTicks();
    }
    complete();
    expect(await result).toEqual([1, 2, 3]);
  });
});
