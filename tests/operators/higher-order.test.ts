import { describe, expect, it } from "vitest";
import {
  collect,
  concatAll,
  concatMap,
  EOF,
  exhaustAll,
  exhaustMap,
  external,
  fromIterable,
  mergeAll,
  mergeMap,
  of,
  switchAll,
  switchMap,
} from "../../src/index.js";
import { probe, waitTicks } from "../helpers.js";

type Step = () => void;
async function run(steps: Step[]): Promise<void> {
  for (const step of steps) {
    step();
    await waitTicks();
  }
}

describe("switchAll()", () => {
  it("passes a lone inner stream through unchanged", async () => {
    expect(await collect(of(of("x", "y")).pipeThrough(switchAll()))).toEqual(["x", "y"]);
  });

  it("follows the newest inner stream and cancels the one it leaves", async () => {
    const searchA = probe<string>();
    const searchB = external<string>();
    const queries = external<ReadableStream<string>>();
    const results = collect(queries.observable.pipeThrough(switchAll()));
    await run([
      () => queries.next(searchA.stream),
      () => searchA.next("a-first"),
      () => queries.next(searchB.observable),
      () => searchA.next("a-stale"),
      () => searchB.next("b-first"),
      () => queries.complete(),
      () => searchB.next("b-second"),
      () => searchB.complete(),
    ]);
    expect(await results).toEqual(["a-first", "b-first", "b-second"]);
    expect(searchA.cancelled).toBe(true);
  });

  it("keeps the active inner stream after the outer completes", async () => {
    const only = external<string>();
    const queries = external<ReadableStream<string>>();
    const results = collect(queries.observable.pipeThrough(switchAll()));
    await run([
      () => queries.next(only.observable),
      () => queries.complete(),
      () => only.next("late-1"),
      () => only.next("late-2"),
      () => only.complete(),
    ]);
    expect(await results).toEqual(["late-1", "late-2"]);
  });

  it("switchMap projects each value and cancels the stale inner stream", async () => {
    const inners = [probe<number>(), probe<number>()];
    const outer = external<number>();
    const result = collect(
      outer.observable.pipeThrough(switchMap((i) => inners[i]?.stream ?? of<number>())),
    );
    await run([
      () => outer.next(0),
      () => inners[0]?.next(1),
      () => inners[0]?.next(10),
      () => outer.next(1),
      () => inners[0]?.next(99),
      () => inners[1]?.next(2),
      () => outer.next(EOF),
      () => inners[1]?.next(20),
      () => inners[1]?.complete(),
    ]);
    expect(await result).toEqual([1, 10, 2, 20]);
    expect(inners[0]?.cancelled).toBe(true);
  });
});

describe("exhaustAll()", () => {
  it("drops and cancels inner streams that arrive while one is active", async () => {
    const saving = external<string>();
    const doubleClick = probe<string>();
    const tripleClick = probe<string>();
    const later = external<string>();
    const saves = external<ReadableStream<string>>();
    const results = collect(saves.observable.pipeThrough(exhaustAll()));
    await run([
      () => saves.next(saving.observable),
      () => saves.next(doubleClick.stream),
      () => saving.next("saved"),
      () => saves.next(tripleClick.stream),
      () => saving.complete(),
      () => saves.next(later.observable),
      () => saves.complete(),
      () => later.next("saved again"),
      () => later.complete(),
    ]);
    expect(await results).toEqual(["saved", "saved again"]);
    expect([doubleClick.cancelled, tripleClick.cancelled]).toEqual([true, true]);
  });

  it("exhaustMap projects", async () => {
    expect(await collect(of(1).pipeThrough(exhaustMap((v) => of(v, v))))).toEqual([1, 1]);
  });
});

describe("concatAll() and concatMap()", () => {
  it("concatenates inner streams in order", async () => {
    expect(await collect(fromIterable([of(1, 2), of(3)]).pipeThrough(concatAll()))).toEqual([
      1, 2, 3,
    ]);
  });

  it("does not project the next value until the previous stream completes", async () => {
    const started: number[] = [];
    const inner = external<string>();
    const result = collect(
      of(1, 2).pipeThrough(
        concatMap((v) => {
          started.push(v);
          return v === 1 ? inner.observable : of("b");
        }),
      ),
    );
    await waitTicks();
    expect(started).toEqual([1]);
    inner.next("a");
    inner.next(EOF);
    expect(await result).toEqual(["a", "b"]);
    expect(started).toEqual([1, 2]);
  });
});

describe("mergeAll() and mergeMap()", () => {
  it("interleaves inner streams", async () => {
    const a = external<number>();
    const b = external<number>();
    const result = collect(of(a.observable, b.observable).pipeThrough(mergeAll()));
    await run([
      () => a.next(1),
      () => b.next(2),
      () => a.next(3),
      () => a.next(EOF),
      () => b.next(EOF),
    ]);
    expect(await result).toEqual([1, 2, 3]);
  });

  it("limits concurrency", async () => {
    const inners = [probe<number>(), probe<number>(), probe<number>()];
    const projected: number[] = [];
    const result = collect(
      of(0, 1, 2).pipeThrough(
        mergeMap((i) => {
          projected.push(i);
          return inners[i]?.stream ?? of<number>();
        }, 2),
      ),
    );
    await waitTicks();
    expect(projected).toEqual([0, 1]);
    inners[1]?.next(1);
    inners[1]?.complete();
    await waitTicks();
    expect(projected).toEqual([0, 1, 2]);
    inners[0]?.complete();
    inners[2]?.complete();
    expect(await result).toEqual([1]);
  });
});

describe("source errors while busy", () => {
  it("concatMap reports a source error even while an inner stream is still running", async () => {
    const outer = probe<number>();
    const inner = probe<number>();
    const result = collect(outer.stream.pipeThrough(concatMap(() => inner.stream)));
    await waitTicks();
    outer.next(1);
    outer.next(2);
    await waitTicks();
    outer.error(new Error("source failed"));
    await expect(result).rejects.toThrow("source failed");
    await waitTicks();
    expect(inner.cancelled).toBe(true);
  });
});
