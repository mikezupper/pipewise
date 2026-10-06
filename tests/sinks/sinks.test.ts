import { describe, expect, it, vi } from "vitest";
import {
  collect,
  createStream,
  EmptyError,
  firstValueFrom,
  lastValueFrom,
  of,
  subscribe,
} from "../../src/index.js";
import { probe, waitTicks } from "../helpers.js";

describe("collect()", () => {
  it("resolves with all values", async () => {
    expect(await collect(of(1, 2))).toEqual([1, 2]);
  });
});

describe("firstValueFrom()", () => {
  it("resolves with the first value and cancels the stream", async () => {
    const source = probe<number>();
    const result = firstValueFrom(source.stream);
    source.next(1);
    expect(await result).toBe(1);
    await waitTicks();
    expect(source.cancelled).toBe(true);
  });

  it("rejects with EmptyError when empty", async () => {
    await expect(firstValueFrom(of())).rejects.toBeInstanceOf(EmptyError);
  });
});

describe("lastValueFrom()", () => {
  it("resolves with the last value", async () => {
    expect(await lastValueFrom(of(1, 2, 3))).toBe(3);
    await expect(lastValueFrom(of())).rejects.toBeInstanceOf(EmptyError);
  });
});

describe("subscribe()", () => {
  it("calls next for each value and complete at the end", async () => {
    const next = vi.fn();
    const complete = vi.fn();
    await of(1, 2).pipeTo(subscribe<number>({ next, complete }));
    expect(next.mock.calls).toEqual([[1], [2]]);
    expect(complete).toHaveBeenCalledOnce();
  });

  it("accepts a bare function and works with no arguments", async () => {
    const seen: number[] = [];
    await of(1).pipeTo(subscribe((v: number) => seen.push(v)));
    await of(1).pipeTo(subscribe());
    expect(seen).toEqual([1]);
  });

  it("calls error when the source errors", async () => {
    const error = vi.fn();
    const failing = createStream<number>((s) => {
      s.error(new Error("x"));
    });
    await expect(failing.pipeTo(subscribe({ error }))).rejects.toThrow("x");
    expect(error).toHaveBeenCalledOnce();
  });
});
