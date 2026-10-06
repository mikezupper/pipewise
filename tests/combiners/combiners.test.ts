import { describe, expect, it } from "vitest";
import {
  collect,
  combineLatest,
  concat,
  EOF,
  external,
  forkJoin,
  merge,
  of,
  race,
  zip,
} from "../../src/index.js";
import { probe, waitTicks } from "../helpers.js";

describe("merge()", () => {
  it("emits values from all sources in arrival order", async () => {
    const a = external<number>();
    const b = external<number>();
    const result = collect(merge(a.observable, b.observable));
    for (const step of [
      () => a.next(1),
      () => b.next(2),
      () => a.next(3),
      () => a.next(EOF),
      () => b.next(4),
      () => b.next(EOF),
    ]) {
      step();
      await waitTicks();
    }
    expect(await result).toEqual([1, 2, 3, 4]);
  });

  it("completes immediately with no sources", async () => {
    expect(await collect(merge())).toEqual([]);
  });
});

describe("concat()", () => {
  it("emits each source in order", async () => {
    expect(await collect(concat(of(1, 2), of(3), of<number>()))).toEqual([1, 2, 3]);
  });

  it("cancels sources it never reached", async () => {
    const later = probe<number>();
    await collect(
      concat(of(1), later.stream).pipeThrough(
        new TransformStream({
          transform(_c, ctl) {
            ctl.terminate();
          },
        }),
      ),
    );
    await waitTicks();
    expect(later.cancelled).toBe(true);
  });
});

describe("combineLatest()", () => {
  it("emits the latest of each once all have emitted", async () => {
    const a = external<string>();
    const b = external<number>();
    const result = collect(combineLatest(a.observable, b.observable));
    for (const step of [
      () => a.next("a"),
      () => a.next("b"),
      () => b.next(1),
      () => a.next("c"),
      () => b.next(2),
      () => a.next(EOF),
      () => b.next(EOF),
    ]) {
      step();
      await waitTicks();
    }
    expect(await result).toEqual([
      ["b", 1],
      ["c", 1],
      ["c", 2],
    ]);
  });
});

describe("zip()", () => {
  it("pairs values by position and stops at the shortest", async () => {
    expect(await collect(zip(of(1, 2, 3), of("a", "b")))).toEqual([
      [1, "a"],
      [2, "b"],
    ]);
  });

  it("cancels the longer sources when one completes", async () => {
    const long = probe<number>();
    const result = collect(zip(of(1), long.stream));
    await waitTicks();
    long.next(10);
    await waitTicks();
    long.next(11);
    expect(await result).toEqual([[1, 10]]);
    await waitTicks();
    expect(long.cancelled).toBe(true);
  });
});

describe("forkJoin()", () => {
  it("emits the last value of each source", async () => {
    expect(await collect(forkJoin(of(1, 2), of("x")))).toEqual([[2, "x"]]);
  });

  it("completes without emitting if a source is empty", async () => {
    expect(await collect(forkJoin(of(1), of()))).toEqual([]);
  });
});

describe("race()", () => {
  it("follows the first source to act and cancels the rest", async () => {
    const primary = probe<string>();
    const mirror = probe<string>();
    const silent = probe<string>();
    const winner = collect(race(primary.stream, mirror.stream, silent.stream));
    await waitTicks();
    mirror.next("mirror-1");
    await waitTicks();
    primary.next("primary-1");
    mirror.next("mirror-2");
    mirror.complete();
    expect(await winner).toEqual(["mirror-1", "mirror-2"]);
    expect([primary.cancelled, silent.cancelled]).toEqual([true, true]);
  });
});
