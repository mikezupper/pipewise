import { describe, expect, it } from "vitest";
import {
  collect,
  combineLatestAll,
  concatWith,
  createStream,
  empty,
  EOF,
  expand,
  external,
  groupBy,
  mergeMap,
  mergeScan,
  of,
  onErrorResumeNextWith,
  raceWith,
  sequenceEqual,
  switchScan,
  take,
  throwError,
  toArray,
  withLatestFrom,
  zipAll,
  type GroupedStream,
} from "../../src/index.js";
import { probe, waitTicks } from "../helpers.js";

type Step = () => void;
async function run(steps: Step[]): Promise<void> {
  for (const step of steps) {
    step();
    await waitTicks();
  }
}

describe("concatWith(), raceWith(), onErrorResumeNextWith()", () => {
  it("concatWith appends", async () => {
    expect(await collect(of(1, 2).pipeThrough(concatWith(of(3), of(4))))).toEqual([1, 2, 3, 4]);
  });

  it("raceWith mirrors the first to act", async () => {
    const slow = probe<number>();
    const result = collect(slow.stream.pipeThrough(raceWith(of(9))));
    expect(await result).toEqual([9]);
    expect(slow.cancelled).toBe(true);
  });

  it("onErrorResumeNextWith skips errors", async () => {
    const failing = createStream<number>((s) => {
      s.next(1);
      s.error(new Error("x"));
    });
    expect(await collect(failing.pipeThrough(onErrorResumeNextWith(of(2))))).toEqual([1, 2]);
  });
});

describe("combineLatestAll() and zipAll()", () => {
  it("combine the inner streams once the outer completes", async () => {
    expect(await collect(of(of(0), of(1, 2)).pipeThrough(combineLatestAll()))).toEqual([
      [0, 1],
      [0, 2],
    ]);
    expect(await collect(of(of(1, 2), of(3, 4)).pipeThrough(zipAll()))).toEqual([
      [1, 3],
      [2, 4],
    ]);
  });
});

describe("withLatestFrom()", () => {
  it("pairs each value with the latest of the others once all have emitted", async () => {
    const { observable, next } = external<string>();
    const other = external<number>();
    const result = collect(observable.pipeThrough(withLatestFrom(other.observable)));
    await run([
      () => next("dropped"),
      () => other.next(1),
      () => other.next(2),
      () => next("a"),
      () => other.next(EOF),
      () => next("b"),
      () => next(EOF),
    ]);
    expect(await result).toEqual([
      ["a", 2],
      ["b", 2],
    ]);
  });
});

describe("sequenceEqual()", () => {
  it("compares values, order, and length", async () => {
    expect(await collect(of(1, 2, 3).pipeThrough(sequenceEqual(of(1, 2, 3))))).toEqual([true]);
    expect(await collect(of(1, 2).pipeThrough(sequenceEqual(of(1, 2, 3))))).toEqual([false]);
    expect(await collect(of(1, 9).pipeThrough(sequenceEqual(of(1, 2))))).toEqual([false]);
    const caseless = sequenceEqual(
      of("A"),
      (a: string, b: string) => a.toLowerCase() === b.toLowerCase(),
    );
    expect(await collect(of("a").pipeThrough(caseless))).toEqual([true]);
  });

  it("answers false as soon as they differ and cancels both", async () => {
    const a = probe<number>();
    const b = probe<number>();
    const result = collect(a.stream.pipeThrough(sequenceEqual(b.stream)));
    await run([() => a.next(1), () => b.next(2)]);
    expect(await result).toEqual([false]);
    await waitTicks();
    expect([a.cancelled, b.cancelled]).toEqual([true, true]);
  });
});

describe("expand()", () => {
  it("projects recursively until projections are empty", async () => {
    const doubled = of(1).pipeThrough(expand((n) => (n < 8 ? of(n * 2) : empty())));
    expect(await collect(doubled)).toEqual([1, 2, 4, 8]);
  });

  it("works with take on an infinite expansion", async () => {
    expect(
      await collect(
        of(0)
          .pipeThrough(expand((n) => of(n + 1)))
          .pipeThrough(take(4)),
      ),
    ).toEqual([0, 1, 2, 3]);
  });

  it("propagates projection errors", async () => {
    await expect(
      collect(of(1).pipeThrough(expand(() => throwError(() => new Error("deep"))))),
    ).rejects.toThrow("deep");
  });
});

describe("mergeScan() and switchScan()", () => {
  it("mergeScan accumulates through streams", async () => {
    const running = of(1, 2, 3).pipeThrough(
      mergeScan((acc: number, n: number) => of(acc + n), 0, 1),
    );
    expect(await collect(running)).toEqual([1, 3, 6]);
  });

  it("switchScan accumulates through the latest stream", async () => {
    const outer = external<number>();
    const inners = [external<number>(), external<number>()];
    let i = 0;
    const result = collect(
      outer.observable.pipeThrough(
        switchScan(() => (inners[i++] as (typeof inners)[0]).observable, 100),
      ),
    );
    await run([
      () => outer.next(1),
      () => inners[0]?.next(101),
      () => outer.next(2),
      () => inners[0]?.next(999),
      () => inners[1]?.next(102),
      () => outer.next(EOF),
      () => inners[1]?.next(EOF),
    ]);
    expect(await result).toEqual([101, 102]);
  });
});

describe("groupBy()", () => {
  const groupsOf = async <K, T>(stream: ReadableStream<GroupedStream<K, T>>): Promise<[K, T[]][]> =>
    collect(
      stream.pipeThrough(
        mergeMap((g) =>
          g.pipeThrough(toArray()).pipeThrough(
            new TransformStream({
              transform: (values, c) => {
                c.enqueue([g.key, values]);
              },
            }),
          ),
        ),
      ),
    );

  it("splits values into keyed groups", async () => {
    const groups = await groupsOf(
      of(1, 2, 3, 4, 5).pipeThrough(groupBy((n) => (n % 2 ? "odd" : "even"))),
    );
    expect(new Map(groups)).toEqual(
      new Map([
        ["odd", [1, 3, 5]],
        ["even", [2, 4]],
      ]),
    );
  });

  it("maps elements and closes groups by duration", async () => {
    const { observable, next } = external<string>();
    const close = external<null>();
    const result = groupsOf(
      observable.pipeThrough(
        groupBy((s) => s[0], { element: (s) => s.toUpperCase(), duration: () => close.observable }),
      ),
    );
    await run([() => next("ab"), () => close.next(null), () => next("ac"), () => next(EOF)]);
    expect(await result).toEqual([
      ["a", ["AB"]],
      ["a", ["AC"]],
    ]);
  });

  it("errors every group when the source errors", async () => {
    const source = probe<number>();
    const reader = source.stream.pipeThrough(groupBy(() => "k")).getReader();
    source.next(1);
    const group = (await reader.read()).value;
    source.error(new Error("boom"));
    await expect(reader.read()).rejects.toThrow("boom");
    await expect(group ? collect(group) : Promise.resolve()).rejects.toThrow("boom");
  });
});
