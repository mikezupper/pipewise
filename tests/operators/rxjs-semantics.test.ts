/** RxJS 7.8.2 semantics: buffer, window, single, first, last, bufferCount, scan, reduce, distinct, throttleTime, timeout. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bufferCount,
  collect,
  distinct,
  EmptyError,
  EOF,
  external,
  first,
  last,
  NotFoundError,
  of,
  reduce,
  scan,
  SequenceError,
  single,
  throttleTime,
  timeout,
  TimeoutError,
} from "../../src/index.js";
import { probe, waitTicks } from "../helpers.js";

describe("first() and last() with a default", () => {
  it("emit the default on an empty source", async () => {
    expect(await collect(of<number>().pipeThrough(first(null, 0)))).toEqual([0]);
    expect(await collect(of<number>().pipeThrough(last(null, 0)))).toEqual([0]);
    expect(await collect(of(1, 2).pipeThrough(first((n) => n > 5, -1)))).toEqual([-1]);
    expect(await collect(of(1, 2).pipeThrough(last(null, undefined)))).toEqual([2]);
  });

  it("an explicit undefined default still counts as a default", async () => {
    expect(await collect(of<number>().pipeThrough(first(null, undefined)))).toEqual([undefined]);
  });
});

describe("single() with a predicate", () => {
  it("emits the only match", async () => {
    expect(await collect(of(1, 2, 3).pipeThrough(single((n) => n === 2)))).toEqual([2]);
  });

  it("distinguishes no values, no match, and too many matches", async () => {
    await expect(collect(of<number>().pipeThrough(single((n) => n > 0)))).rejects.toBeInstanceOf(
      EmptyError,
    );
    await expect(collect(of(1).pipeThrough(single((n) => n > 5)))).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(collect(of(1, 2).pipeThrough(single((n) => n > 0)))).rejects.toBeInstanceOf(
      SequenceError,
    );
  });
});

describe("bufferCount() with startBufferEvery", () => {
  it("overlaps when startBufferEvery < size", async () => {
    expect(await collect(of(1, 2, 3, 4).pipeThrough(bufferCount(2, 1)))).toEqual([
      [1, 2],
      [2, 3],
      [3, 4],
      [4],
    ]);
  });

  it("skips when startBufferEvery > size", async () => {
    expect(await collect(of(1, 2, 3, 4, 5).pipeThrough(bufferCount(2, 3)))).toEqual([
      [1, 2],
      [4, 5],
    ]);
  });
});

describe("scan() and reduce() without a seed", () => {
  it("scan seeds with the first value", async () => {
    expect(
      await collect(of(3, 1, 4).pipeThrough(scan((a: number, b: number) => Math.max(a, b)))),
    ).toEqual([3, 3, 4]);
  });

  it("reduce seeds with the first value and emits nothing when empty", async () => {
    expect(await collect(of(1, 2, 3).pipeThrough(reduce((a: number, b: number) => a + b)))).toEqual(
      [6],
    );
    expect(
      await collect(of<number>().pipeThrough(reduce((a: number, b: number) => a + b))),
    ).toEqual([]);
  });

  it("indexes count every value, including the one used as the seed", async () => {
    const indexes: number[] = [];
    await collect(
      of("a", "b", "c").pipeThrough(
        scan((acc: string, v: string, i: number) => {
          indexes.push(i);
          return acc + v;
        }),
      ),
    );
    expect(indexes).toEqual([1, 2]);
  });
});

describe("distinct() with flushes", () => {
  it("forgets seen keys each time flushes emits", async () => {
    const flushes = external<null>();
    const { observable, next } = external<number>();
    const result = collect(observable.pipeThrough(distinct(undefined, flushes.observable)));
    for (const step of [
      () => next(1),
      () => next(1),
      () => flushes.next(null),
      () => next(1),
      () => next(EOF),
    ]) {
      step();
      await waitTicks();
    }
    expect(await result).toEqual([1, 1]);
  });
});

describe("time-based alignment", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("throttleTime trailing waits for the window to close before completing", async () => {
    const { observable, next } = external<number>();
    const seen: number[] = [];
    let done = false;
    void observable
      .pipeThrough(throttleTime(10, { trailing: true }))
      .pipeTo(new WritableStream({ write: (v) => void seen.push(v) }))
      .then(() => (done = true));
    next(1);
    await waitTicks();
    next(2);
    await waitTicks();
    next(EOF);
    await vi.advanceTimersByTimeAsync(5);
    expect(seen).toEqual([1]);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(5);
    expect(seen).toEqual([1, 2]);
    expect(done).toBe(true);
  });

  it("timeout({ first, each }) uses separate limits", async () => {
    const source = probe<number>();
    const result = collect(source.stream.pipeThrough(timeout({ first: 50, each: 10 })));
    const assertion = expect(result).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(40);
    source.next(1);
    await vi.advanceTimersByTimeAsync(11);
    await assertion;
  });

  it("timeout({ first }) only limits the first value", async () => {
    const { observable, next } = external<number>();
    const result = collect(observable.pipeThrough(timeout({ first: 10 })));
    next(1);
    await vi.advanceTimersByTimeAsync(100);
    next(2);
    next(EOF);
    expect(await result).toEqual([1, 2]);
  });

  it("timeout({ with }) switches to the fallback and cancels the source", async () => {
    const source = probe<number>();
    const result = collect(
      source.stream.pipeThrough(
        timeout({
          each: 10,
          with: ({ lastValue, seen }) =>
            of(`fallback after ${String(lastValue)} (${String(seen)})`),
        }),
      ),
    );
    await waitTicks();
    source.next(7);
    await vi.advanceTimersByTimeAsync(11);
    expect(await result).toEqual([7, "fallback after 7 (1)"]);
    expect(source.cancelled).toBe(true);
  });

  it("timeout rejects a config with no limit", () => {
    expect(() => timeout({})).toThrow(TypeError);
  });
});
