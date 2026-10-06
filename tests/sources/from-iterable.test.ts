import { describe, expect, it } from "vitest";
import {
  collect,
  fromGenerator,
  fromIterable,
  of,
  range,
  repeatValue,
  take,
} from "../../src/index.js";
import { waitTicks } from "../helpers.js";

describe("fromIterable()", () => {
  it("emits each value", async () => {
    expect(await collect(fromIterable([1, 2, 3]))).toEqual([1, 2, 3]);
    expect(await collect(fromIterable(new Set(["a", "b"])))).toEqual(["a", "b"]);
  });

  it("is lazy, so infinite generators work, and runs finally on cancel", async () => {
    let cleanedUp = false;
    function* naturals(): Generator<number> {
      try {
        for (let i = 0; ; i++) yield i;
      } finally {
        cleanedUp = true;
      }
    }
    expect(await collect(fromIterable(naturals()).pipeThrough(take(3)))).toEqual([0, 1, 2]);
    await waitTicks();
    expect(cleanedUp).toBe(true);
  });

  it("errors if the iterator throws", async () => {
    function* broken(): Generator<number> {
      yield 1;
      throw new Error("boom");
    }
    await expect(collect(fromIterable(broken()))).rejects.toThrow("boom");
  });
});

describe("fromGenerator()", () => {
  it("emits generated values", async () => {
    const stream = fromGenerator(function* () {
      yield 1;
      yield 2;
    });
    expect(await collect(stream)).toEqual([1, 2]);
  });
});

describe("of()", () => {
  it("emits its arguments", async () => {
    expect(await collect(of(1, 2, 3))).toEqual([1, 2, 3]);
    expect(await collect(of())).toEqual([]);
  });
});

describe("range()", () => {
  it("emits count integers from start", async () => {
    expect(await collect(range(1, 4))).toEqual([1, 2, 3, 4]);
    expect(await collect(range(-2, 3))).toEqual([-2, -1, 0]);
    expect(await collect(range(5, 0))).toEqual([]);
  });
});

describe("repeatValue()", () => {
  it("repeats forever", async () => {
    expect(await collect(repeatValue(7).pipeThrough(take(3)))).toEqual([7, 7, 7]);
  });
});
