import { describe, expect, it } from "vitest";
import {
  collect,
  filter,
  map,
  mergeWith,
  of,
  subchain,
  zipWith,
  combineLatestWith,
} from "../../src/index.js";

describe("subchain()", () => {
  it("packages a sub-pipeline as one operator", async () => {
    const evensTimesTen = subchain((s: ReadableStream<number>) =>
      s.pipeThrough(filter((v) => v % 2 === 0)).pipeThrough(map((v) => v * 10)),
    );
    expect(await collect(of(1, 2, 3, 4).pipeThrough(evensTimesTen))).toEqual([20, 40]);
  });
});

describe("mergeWith(), zipWith(), combineLatestWith()", () => {
  it("mergeWith merges", async () => {
    expect((await collect(of(1).pipeThrough(mergeWith(of("a"))))).sort()).toEqual([1, "a"]);
  });

  it("zipWith zips", async () => {
    expect(await collect(of(1, 2).pipeThrough(zipWith(of("a", "b"))))).toEqual([
      [1, "a"],
      [2, "b"],
    ]);
  });

  it("combineLatestWith combines", async () => {
    expect(await collect(of(1).pipeThrough(combineLatestWith(of("a"))))).toEqual([[1, "a"]]);
  });
});
