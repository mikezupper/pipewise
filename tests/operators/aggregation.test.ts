import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ArgumentOutOfRangeError,
  collect,
  count,
  createStream,
  defaultIfEmpty,
  dematerialize,
  distinctUntilKeyChanged,
  elementAt,
  EmptyError,
  every,
  external,
  find,
  findIndex,
  ignoreElements,
  isEmpty,
  materialize,
  max,
  min,
  of,
  skipLast,
  skipWhile,
  takeLast,
  throwError,
  throwIfEmpty,
  timeInterval,
  timestamp,
  type Notification,
} from "../../src/index.js";
import { probe, waitTicks } from "../helpers.js";

describe("count(), max(), min()", () => {
  it("count counts all or matching values", async () => {
    expect(await collect(of("a", "b", "c").pipeThrough(count()))).toEqual([3]);
    expect(await collect(of(1, 2, 3).pipeThrough(count((n) => n > 1)))).toEqual([2]);
    expect(await collect(of().pipeThrough(count()))).toEqual([0]);
  });

  it("max and min use < and > or a comparer, and emit nothing when empty", async () => {
    expect(await collect(of(3, 9, 4).pipeThrough(max()))).toEqual([9]);
    expect(await collect(of(3, 9, 4).pipeThrough(min()))).toEqual([3]);
    const byAge = (a: { age: number }, b: { age: number }): number => a.age - b.age;
    expect(await collect(of({ age: 30 }, { age: 50 }).pipeThrough(max(byAge)))).toEqual([
      { age: 50 },
    ]);
    expect(await collect(of<number>().pipeThrough(max()))).toEqual([]);
  });
});

describe("defaultIfEmpty(), throwIfEmpty(), isEmpty()", () => {
  it("defaultIfEmpty fills in only when empty", async () => {
    expect(await collect(of<number>().pipeThrough(defaultIfEmpty("none")))).toEqual(["none"]);
    expect(await collect(of(1).pipeThrough(defaultIfEmpty("none")))).toEqual([1]);
  });

  it("throwIfEmpty errors only when empty", async () => {
    await expect(collect(of().pipeThrough(throwIfEmpty()))).rejects.toBeInstanceOf(EmptyError);
    await expect(
      collect(of().pipeThrough(throwIfEmpty(() => new Error("custom")))),
    ).rejects.toThrow("custom");
    expect(await collect(of(1).pipeThrough(throwIfEmpty()))).toEqual([1]);
  });

  it("isEmpty answers at the first value and cancels the source", async () => {
    expect(await collect(of().pipeThrough(isEmpty()))).toEqual([true]);
    const source = probe<number>();
    const result = collect(source.stream.pipeThrough(isEmpty()));
    source.next(1);
    expect(await result).toEqual([false]);
    await waitTicks();
    expect(source.cancelled).toBe(true);
  });
});

describe("every(), find(), findIndex(), elementAt()", () => {
  it("every stops at the first miss", async () => {
    expect(await collect(of(2, 4).pipeThrough(every((n) => n % 2 === 0)))).toEqual([true]);
    const source = probe<number>();
    const result = collect(source.stream.pipeThrough(every((n) => n < 5)));
    source.next(1);
    source.next(9);
    expect(await result).toEqual([false]);
    await waitTicks();
    expect(source.cancelled).toBe(true);
  });

  it("find and findIndex report a match or its absence", async () => {
    expect(await collect(of(1, 5, 9).pipeThrough(find((n) => n > 3)))).toEqual([5]);
    expect(await collect(of(1).pipeThrough(find((n) => n > 3)))).toEqual([undefined]);
    expect(await collect(of("a", "b").pipeThrough(findIndex((s) => s === "b")))).toEqual([1]);
    expect(await collect(of("a").pipeThrough(findIndex((s) => s === "z")))).toEqual([-1]);
  });

  it("elementAt picks by position, falls back to a default, or errors", async () => {
    expect(await collect(of("a", "b", "c").pipeThrough(elementAt(1)))).toEqual(["b"]);
    expect(await collect(of("a").pipeThrough(elementAt(5, "z")))).toEqual(["z"]);
    await expect(collect(of("a").pipeThrough(elementAt(5)))).rejects.toBeInstanceOf(
      ArgumentOutOfRangeError,
    );
    expect(() => elementAt(-1)).toThrow(ArgumentOutOfRangeError);
  });
});

describe("ignoreElements(), skipLast(), skipWhile(), takeLast()", () => {
  it("ignoreElements keeps only completion and errors", async () => {
    expect(await collect(of(1, 2).pipeThrough(ignoreElements()))).toEqual([]);
    await expect(
      collect(throwError(() => new Error("e")).pipeThrough(ignoreElements())),
    ).rejects.toThrow("e");
  });

  it("skipLast drops the tail", async () => {
    expect(await collect(of(1, 2, 3, 4).pipeThrough(skipLast(2)))).toEqual([1, 2]);
    expect(await collect(of(1, 2).pipeThrough(skipLast(0)))).toEqual([1, 2]);
  });

  it("skipWhile drops the head", async () => {
    expect(await collect(of(1, 2, 3, 1).pipeThrough(skipWhile((n) => n < 3)))).toEqual([3, 1]);
  });

  it("takeLast keeps the tail", async () => {
    expect(await collect(of(1, 2, 3, 4).pipeThrough(takeLast(2)))).toEqual([3, 4]);
    expect(await collect(of(1, 2).pipeThrough(takeLast(0)))).toEqual([]);
  });
});

describe("distinctUntilKeyChanged()", () => {
  it("compares one property", async () => {
    const users = of({ id: 1, n: "a" }, { id: 1, n: "b" }, { id: 2, n: "c" });
    expect(await collect(users.pipeThrough(distinctUntilKeyChanged("id")))).toEqual([
      { id: 1, n: "a" },
      { id: 2, n: "c" },
    ]);
    const names = of({ n: "A" }, { n: "a" }, { n: "b" });
    const caseless = distinctUntilKeyChanged<{ n: string }, "n">(
      "n",
      (x, y) => x.toLowerCase() === y.toLowerCase(),
    );
    expect(await collect(names.pipeThrough(caseless))).toEqual([{ n: "A" }, { n: "b" }]);
  });
});

describe("materialize() and dematerialize()", () => {
  it("materialize turns values, completion, and errors into notifications", async () => {
    expect(await collect(of(1).pipeThrough(materialize()))).toEqual([
      { kind: "N", value: 1 },
      { kind: "C" },
    ]);
    const failing = createStream<number>((s) => {
      s.next(1);
      s.error("boom");
    });
    expect(await collect(failing.pipeThrough(materialize()))).toEqual([
      { kind: "N", value: 1 },
      { kind: "E", error: "boom" },
    ]);
  });

  it("dematerialize reverses it", async () => {
    const ok = of<Notification<number>>(
      { kind: "N", value: 1 },
      { kind: "C" },
      { kind: "N", value: 2 },
    );
    expect(await collect(ok.pipeThrough(dematerialize()))).toEqual([1]);
    const failed = of<Notification<number>>(
      { kind: "N", value: 1 },
      { kind: "E", error: new Error("x") },
    );
    await expect(collect(failed.pipeThrough(dematerialize()))).rejects.toThrow("x");
  });
});

describe("timeInterval() and timestamp()", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: 1_000 });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("timeInterval measures gaps from the start", async () => {
    const { observable, next, complete } = external<string>();
    const result = collect(observable.pipeThrough(timeInterval()));
    await vi.advanceTimersByTimeAsync(10);
    next("a");
    await vi.advanceTimersByTimeAsync(25);
    next("b");
    complete();
    expect(await result).toEqual([
      { value: "a", interval: 10 },
      { value: "b", interval: 25 },
    ]);
  });

  it("timestamp records Date.now()", async () => {
    const { observable, next, complete } = external<string>();
    const result = collect(observable.pipeThrough(timestamp()));
    await vi.advanceTimersByTimeAsync(5);
    next("a");
    complete();
    expect(await result).toEqual([{ value: "a", timestamp: 1_005 }]);
  });
});
