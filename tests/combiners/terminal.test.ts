import { describe, expect, it } from "vitest";
import { collect, empty, forkJoin, of, race, zip } from "../../src/index.js";
import { probe, waitTicks } from "../helpers.js";

it("forkJoin completes and cancels silent peers when an input is empty", async () => {
  const silent = probe<number>();
  expect(await collect(forkJoin(empty(), silent.stream))).toEqual([]);
  await waitTicks();
  expect(silent.cancelled).toBe(true);
  expect(silent.stream.locked).toBe(false);
  expect(await collect(forkJoin())).toEqual([]);
});

describe.each([race, zip])("combiner reader cleanup", (combine) => {
  it("releases all readers on completion", async () => {
    const a = of(1);
    const b = of(2);
    await collect(combine(a, b));
    await waitTicks();
    expect(a.locked).toBe(false);
    expect(b.locked).toBe(false);
    expect(await collect(combine())).toEqual([]);
  });

  it("releases all readers on error", async () => {
    const a = probe<number>();
    const b = probe<number>();
    const result = collect(combine(a.stream, b.stream));
    a.error(new Error("failed"));
    await expect(result).rejects.toThrow("failed");
    await waitTicks();
    expect(a.stream.locked).toBe(false);
    expect(b.stream.locked).toBe(false);
    expect(b.cancelled).toBe(true);
  });
});
