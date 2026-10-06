import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  debounceTime,
  defer,
  delay,
  filter,
  map,
  merge,
  switchMap,
  take,
  timer,
} from "../../src/index.js";
import { deepEqual, marbles, parseMarbles, renderMarbles } from "../../src/testing/index.js";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const kit = (): ReturnType<typeof marbles> =>
  marbles({ advance: (ms) => vi.advanceTimersByTimeAsync(ms) });

describe("parseMarbles() and renderMarbles()", () => {
  it("parse frames, values, groups, completion, and errors", () => {
    const boom = new Error("boom");
    expect(parseMarbles("-a-(bc)|", { a: 1, b: 2, c: 3 })).toEqual([
      { frame: 1, kind: "next", value: 1 },
      { frame: 3, kind: "next", value: 2 },
      { frame: 3, kind: "next", value: 3 },
      { frame: 4, kind: "complete" },
    ]);
    expect(parseMarbles("x #", {}, boom)).toEqual([
      { frame: 0, kind: "next", value: "x" },
      { frame: 1, kind: "error", error: boom },
    ]);
    expect(() => parseMarbles("(ab")).toThrow(SyntaxError);
  });

  it("render is the inverse of parse", () => {
    const values = { a: 1, b: 2, c: 3 };
    for (const diagram of ["-a-(bc)|", "a--#", "(ab)|", "-x-|"]) {
      expect(renderMarbles(parseMarbles(diagram, values), values)).toBe(diagram);
    }
    expect(renderMarbles([{ frame: 0, kind: "next", value: 99 }], values)).toBe("?");
  });
});

describe("deepEqual()", () => {
  it("compares structure", () => {
    expect(deepEqual({ a: [1, { b: new Date(5) }] }, { a: [1, { b: new Date(5) }] })).toBe(true);
    expect(deepEqual([1, 2], { 0: 1, 1: 2 })).toBe(false);
    expect(deepEqual(new Error("x"), new Error("x"))).toBe(true);
    expect(deepEqual(NaN, NaN)).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });
});

describe("marbles()", () => {
  it("tests a synchronous operator", async () => {
    const m = kit();
    const source = m.cold("-a-b-c|", { a: 1, b: 2, c: 3 });
    await m.expect(
      source.pipeThrough(filter((n) => n !== 2)).pipeThrough(map((n) => n * 10)),
      "-a---c|",
      { a: 10, c: 30 },
    );
  });

  it("tests timing operators", async () => {
    const m = kit();
    await m.expect(m.cold("ab-|").pipeThrough(delay(20)), "--ab-|");
    await m.expect(m.cold("ab---c|").pipeThrough(debounceTime(20)), "---b--(c|)");
  });

  it("cold sources start on first read; hot sources start at creation", async () => {
    const m = kit();
    const hot = m.hot("ab|");
    await vi.advanceTimersByTimeAsync(10);
    // a and b were emitted before anyone read; completion at 20 ms is one frame in.
    await m.expect(hot, "-|");
    const cold = m.cold("ab|");
    await vi.advanceTimersByTimeAsync(10);
    await m.expect(cold, "ab|");
  });

  it("checks errors and cancellation", async () => {
    const m = kit();
    const boom = new Error("boom");
    await m.expect(merge(m.cold("a-#", {}, boom), m.cold("-b")), "ab#", {}, boom);
    await m.expect(m.cold("abcd|").pipeThrough(take(2)), "a(b|)");
  });

  it("fails with both diagrams when the stream does not match", async () => {
    const m = kit();
    await expect(m.expect(m.cold("-a|", { a: 1 }), "a-|", { a: 1 })).rejects.toThrow(
      /expected: a-\|\n\s+actual: {3}-a\|/,
    );
  });
});

describe("cold sources read mid-run", () => {
  it("play their first frame on the frame they are first read", async () => {
    const m = kit();
    const late = m.cold("ab|");
    const delayed = defer(() => late);
    await m.expect(timer(20).pipeThrough(switchMap(() => delayed)), "--ab|");
  });
});
