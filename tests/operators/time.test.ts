import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  collect,
  debounceTime,
  delay,
  EOF,
  external,
  throttleTime,
  timeout,
  TimeoutError,
} from "../../src/index.js";
import { probe, waitTicks } from "../helpers.js";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

type Step = number | (() => void);
/** Runs callbacks, and advances fake time for numbers. */
async function run(steps: Step[]): Promise<void> {
  for (const step of steps) {
    if (typeof step === "number") await vi.advanceTimersByTimeAsync(step);
    else {
      step();
      await waitTicks();
    }
  }
}

describe("debounceTime()", () => {
  it("emits after a quiet period, and flushes on completion", async () => {
    const { observable, next } = external<string>();
    const typed = collect(observable.pipeThrough(debounceTime(20)));
    await run([
      () => next("h"),
      3,
      () => next("he"),
      25,
      () => next("hel"),
      5,
      () => next("hell"),
      25,
      () => next("hello"),
      () => next(EOF),
    ]);
    expect(await typed).toEqual(["he", "hell", "hello"]);
  });

  it("clears its timer when cancelled", async () => {
    const source = probe<number>();
    const stream = source.stream.pipeThrough(debounceTime(10));
    const reader = stream.getReader();
    source.next(1);
    await waitTicks();
    await reader.cancel();
    await waitTicks();
    expect(vi.getTimerCount()).toBe(0);
    expect(source.cancelled).toBe(true);
  });
});

describe("throttleTime()", () => {
  it("emits the first value per window", async () => {
    const { observable, next } = external<number>();
    const result = collect(observable.pipeThrough(throttleTime(10)));
    await run([() => next(1), 2, () => next(2), 10, () => next(3), () => next(4), () => next(EOF)]);
    expect(await result).toEqual([1, 3]);
  });

  it("emits trailing values when asked", async () => {
    const { observable, next } = external<number>();
    const result = collect(observable.pipeThrough(throttleTime(10, { trailing: true })));
    await run([() => next(1), 2, () => next(2), () => next(3), 10, 10, () => next(EOF)]);
    expect(await result).toEqual([1, 3]);
  });
});

describe("delay()", () => {
  it("shifts values and completion", async () => {
    const { observable, next } = external<string>();
    const seen: string[] = [];
    const done = observable
      .pipeThrough(delay(100))
      .pipeTo(new WritableStream({ write: (v) => void seen.push(v) }));
    await run([() => next("a"), 50, () => next("b"), () => next(EOF), 60]);
    expect(seen).toEqual(["a"]);
    await run([50]);
    expect(seen).toEqual(["a", "b"]);
    await done;
  });
});

describe("timeout()", () => {
  it("errors when the source is silent too long and cancels it", async () => {
    const source = probe<number>();
    const result = collect(source.stream.pipeThrough(timeout(10)));
    const assertion = expect(result).rejects.toBeInstanceOf(TimeoutError);
    await run([() => source.next(1), 5, () => source.next(2), 11]);
    await assertion;
    await waitTicks();
    expect(source.cancelled).toBe(true);
  });

  it("passes values through when on time", async () => {
    const { observable, next } = external<number>();
    const result = collect(observable.pipeThrough(timeout(10)));
    await run([() => next(1), 5, () => next(2), 5, () => next(EOF)]);
    expect(await result).toEqual([1, 2]);
  });
});
