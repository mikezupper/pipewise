import { describe, expect, it } from "vitest";
import { buffer, collect, EOF, external, sample, takeUntil, window } from "../../src/index.js";
import { probe, waitTicks } from "../helpers.js";

type Step = () => void;
async function run(steps: Step[]): Promise<void> {
  for (const step of steps) {
    step();
    await waitTicks();
  }
}

describe("buffer()", () => {
  it("emits an array, possibly empty, on each notifier tick and the rest on completion", async () => {
    const flush = external<null>();
    const { observable, next } = external<string>();
    const batches = collect(observable.pipeThrough(buffer(flush.observable)));
    await run([
      () => next("a"),
      () => next("b"),
      () => flush.next(null),
      () => flush.next(null),
      () => next("c"),
      () => flush.complete(),
      () => next("d"),
      () => next(EOF),
    ]);
    expect(await batches).toEqual([["a", "b"], [], ["c", "d"]]);
  });

  it("cancels the notifier when the source completes", async () => {
    const notifier = probe<null>();
    const { observable, next } = external<number>();
    const result = collect(observable.pipeThrough(buffer(notifier.stream)));
    await run([() => next(1), () => next(EOF)]);
    expect(await result).toEqual([[1]]);
    await waitTicks();
    expect(notifier.cancelled).toBe(true);
  });
});

describe("window()", () => {
  it("opens a window immediately and a new one on each notifier tick", async () => {
    const boundary = external<null>();
    const { observable, next } = external<string>();
    const windows = collect(observable.pipeThrough(window(boundary.observable)));
    await run([
      () => next("a"),
      () => next("b"),
      () => boundary.next(null),
      () => boundary.next(null),
      () => next("c"),
      () => boundary.complete(),
      () => next("d"),
      () => next(EOF),
    ]);
    const contents = await Promise.all((await windows).map((w) => collect(w)));
    expect(contents).toEqual([["a", "b"], [], ["c", "d"]]);
  });

  it("errors the open window and the output when the source errors", async () => {
    const source = probe<number>();
    const windows = source.stream.pipeThrough(window(probe<null>().stream)).getReader();
    const first = (await windows.read()).value;
    source.error(new Error("boom"));
    await expect(windows.read()).rejects.toThrow("boom");
    await expect(first ? collect(first) : Promise.resolve()).rejects.toThrow("boom");
  });
});

describe("sample()", () => {
  it("emits the latest new value on each notifier tick", async () => {
    const tick = external<null>();
    const { observable, next } = external<string>();
    const samples = collect(observable.pipeThrough(sample(tick.observable)));
    await run([
      () => tick.next(null),
      () => next("x10"),
      () => next("x20"),
      () => tick.next(null),
      () => tick.next(null),
      () => next("x30"),
      () => tick.next(null),
      () => tick.complete(),
      () => next("x40"),
      () => next(EOF),
    ]);
    expect(await samples).toEqual(["x20", "x30"]);
  });
});

describe("takeUntil()", () => {
  it("completes when the notifier emits and cancels the source", async () => {
    const source = probe<number>();
    const notifier = external<null>();
    const result = collect(source.stream.pipeThrough(takeUntil(notifier.observable)));
    await run([
      () => source.next(1),
      () => source.next(2),
      () => notifier.next(null),
      () => source.next(3),
    ]);
    expect(await result).toEqual([1, 2]);
    expect(source.cancelled).toBe(true);
  });

  it("ignores a notifier that completes silently", async () => {
    const { observable, next } = external<number>();
    const notifier = external<null>();
    const result = collect(observable.pipeThrough(takeUntil(notifier.observable)));
    await run([() => notifier.next(EOF), () => next(1), () => next(EOF)]);
    expect(await result).toEqual([1]);
  });
});
