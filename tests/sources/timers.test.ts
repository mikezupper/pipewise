import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { collect, interval, take, timer } from "../../src/index.js";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("interval()", () => {
  it("emits a counter and stops its timer when cancelled", async () => {
    const result = collect(interval(10).pipeThrough(take(3)));
    await vi.advanceTimersByTimeAsync(35);
    expect(await result).toEqual([0, 1, 2]);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("timer()", () => {
  it("emits 0 once after the delay", async () => {
    const result = collect(timer(50));
    await vi.advanceTimersByTimeAsync(50);
    expect(await result).toEqual([0]);
  });
});
