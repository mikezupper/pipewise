import { describe, expect, it } from "vitest";
import {
  bufferCount,
  collect,
  distinct,
  distinctUntilChanged,
  EmptyError,
  endWith,
  filter,
  first,
  last,
  map,
  of,
  pairwise,
  range,
  reduce,
  scan,
  SequenceError,
  single,
  skip,
  startWith,
  take,
  takeWhile,
  tap,
  toArray,
} from "../../src/index.js";
import { probe, waitTicks } from "../helpers.js";

describe("map()", () => {
  it("maps values with their index", async () => {
    expect(await collect(of(1, 2, 3).pipeThrough(map((v, i) => v * 10 + i)))).toEqual([10, 21, 32]);
  });

  it("awaits promises", async () => {
    expect(await collect(of(1).pipeThrough(map((v) => Promise.resolve(v + 1))))).toEqual([2]);
  });

  it("errors if the projection throws", async () => {
    const op = map<number, number>(() => {
      throw new Error("bad");
    });
    await expect(collect(of(1).pipeThrough(op))).rejects.toThrow("bad");
  });
});

describe("filter()", () => {
  it("keeps matching values", async () => {
    expect(await collect(range(1, 5).pipeThrough(filter((v) => v % 2 === 1)))).toEqual([1, 3, 5]);
  });
});

describe("scan() and reduce()", () => {
  it("scan emits running totals", async () => {
    expect(await collect(of(1, 2, 3).pipeThrough(scan((a, v) => a + v, 0)))).toEqual([1, 3, 6]);
  });

  it("reduce emits only the total, or the seed when empty", async () => {
    expect(await collect(of(1, 2, 3).pipeThrough(reduce((a, v) => a + v, 0)))).toEqual([6]);
    expect(await collect(of<number>().pipeThrough(reduce((a, v) => a + v, 9)))).toEqual([9]);
  });
});

describe("toArray()", () => {
  it("emits one array", async () => {
    expect(await collect(of(1, 2).pipeThrough(toArray()))).toEqual([[1, 2]]);
  });
});

describe("take()", () => {
  it("takes the first n values and cancels the source", async () => {
    const source = probe<number>();
    const result = collect(source.stream.pipeThrough(take(2)));
    source.next(1);
    source.next(2);
    expect(await result).toEqual([1, 2]);
    await waitTicks();
    expect(source.cancelled).toBe(true);
  });

  it("take(0) completes without waiting for a value", async () => {
    const source = probe<number>();
    expect(await collect(source.stream.pipeThrough(take(0)))).toEqual([]);
  });
});

describe("takeWhile()", () => {
  it("stops at the first failing value", async () => {
    expect(await collect(of(1, 2, 3, 1).pipeThrough(takeWhile((v) => v < 3)))).toEqual([1, 2]);
    expect(await collect(of(1, 2, 3, 1).pipeThrough(takeWhile((v) => v < 3, true)))).toEqual([
      1, 2, 3,
    ]);
  });
});

describe("skip()", () => {
  it("drops the first n values", async () => {
    expect(await collect(of(1, 2, 3).pipeThrough(skip(2)))).toEqual([3]);
  });
});

describe("first(), last(), single()", () => {
  it("first emits the first match", async () => {
    expect(await collect(of(1, 2, 3).pipeThrough(first()))).toEqual([1]);
    expect(await collect(of(1, 2, 3).pipeThrough(first((v) => v > 1)))).toEqual([2]);
  });

  it("last emits the last match", async () => {
    expect(await collect(of(1, 2, 3).pipeThrough(last()))).toEqual([3]);
    expect(await collect(of(1, 2, 3).pipeThrough(last((v) => v < 3)))).toEqual([2]);
  });

  it("first and last error with EmptyError on empty sources", async () => {
    await expect(collect(of().pipeThrough(first()))).rejects.toBeInstanceOf(EmptyError);
    await expect(collect(of().pipeThrough(last()))).rejects.toBeInstanceOf(EmptyError);
  });

  it("single enforces exactly one value", async () => {
    expect(await collect(of(1).pipeThrough(single()))).toEqual([1]);
    await expect(collect(of().pipeThrough(single()))).rejects.toBeInstanceOf(EmptyError);
    await expect(collect(of(1, 2).pipeThrough(single()))).rejects.toBeInstanceOf(SequenceError);
  });
});

describe("tap()", () => {
  it("calls f for each value and passes values through", async () => {
    const seen: number[] = [];
    expect(await collect(of(1, 2).pipeThrough(tap((v) => seen.push(v))))).toEqual([1, 2]);
    expect(seen).toEqual([1, 2]);
  });

  it("waits for async work before the next value", async () => {
    let busy = false;
    let overlapped = false;
    await collect(
      range(1, 4).pipeThrough(
        tap(async () => {
          if (busy) overlapped = true;
          busy = true;
          await waitTicks(3);
          busy = false;
        }),
      ),
    );
    expect(overlapped).toBe(false);
  });

  it("errors the stream if f throws", async () => {
    const op = tap(() => {
      throw new Error("nope");
    });
    await expect(collect(of(1).pipeThrough(op))).rejects.toThrow("nope");
  });
});

describe("distinct() and distinctUntilChanged()", () => {
  it("distinct drops any repeat", async () => {
    expect(await collect(of(1, 2, 1, 3, 2).pipeThrough(distinct()))).toEqual([1, 2, 3]);
    const people = of({ id: 1 }, { id: 1 }, { id: 2 });
    expect(await collect(people.pipeThrough(distinct((p) => p.id)))).toEqual([
      { id: 1 },
      { id: 2 },
    ]);
  });

  it("distinctUntilChanged drops consecutive repeats", async () => {
    expect(await collect(of(1, 1, 2, 2, 1).pipeThrough(distinctUntilChanged()))).toEqual([1, 2, 1]);
    const caseless = distinctUntilChanged<string>((a, b) => a.toLowerCase() === b.toLowerCase());
    expect(await collect(of("a", "A", "b").pipeThrough(caseless))).toEqual(["a", "b"]);
  });
});

describe("startWith(), endWith(), pairwise(), bufferCount()", () => {
  it("startWith and endWith add values", async () => {
    expect(await collect(of(2).pipeThrough(startWith(0, 1)).pipeThrough(endWith(3)))).toEqual([
      0, 1, 2, 3,
    ]);
  });

  it("pairwise emits overlapping pairs", async () => {
    expect(await collect(of(1, 2, 3).pipeThrough(pairwise()))).toEqual([
      [1, 2],
      [2, 3],
    ]);
  });

  it("bufferCount groups by size", async () => {
    expect(await collect(range(1, 5).pipeThrough(bufferCount(2)))).toEqual([[1, 2], [3, 4], [5]]);
    expect(() => bufferCount(0)).toThrow(RangeError);
  });
});
