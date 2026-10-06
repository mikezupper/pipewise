import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  audit,
  auditTime,
  bufferTime,
  bufferToggle,
  bufferWhen,
  collect,
  debounce,
  delayWhen,
  empty,
  EOF,
  external,
  ignoreElements,
  sampleTime,
  skipUntil,
  throttle,
  timer,
  windowCount,
  windowTime,
  windowToggle,
  windowWhen,
} from "../../src/index.js";
import { waitTicks } from "../helpers.js";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

type Step = number | (() => void);
async function run(steps: Step[]): Promise<void> {
  for (const step of steps) {
    if (typeof step === "number") await vi.advanceTimersByTimeAsync(step);
    else {
      step();
      await waitTicks();
    }
  }
}

const unwrap = async <T>(windows: Promise<ReadableStream<T>[]>): Promise<T[][]> =>
  Promise.all((await windows).map((w) => collect(w)));

describe("audit() and auditTime()", () => {
  it("emits the latest value when each duration ends", async () => {
    const { observable, next } = external<number>();
    const result = collect(observable.pipeThrough(auditTime(10)));
    await run([
      () => next(1),
      3,
      () => next(2),
      8,
      () => next(3),
      3,
      () => next(4),
      () => next(EOF),
      10,
    ]);
    expect(await result).toEqual([2, 4]);
  });

  it("waits for the last duration before completing", async () => {
    const { observable, next } = external<number>();
    let done = false;
    const result = collect(observable.pipeThrough(audit(() => timer(10)))).finally(
      () => (done = true),
    );
    await run([() => next(1), () => next(EOF), 5]);
    expect(done).toBe(false);
    await run([5]);
    expect(await result).toEqual([1]);
  });

  it("drops the value if the duration completes without emitting", async () => {
    const { observable, next } = external<number>();
    const result = collect(observable.pipeThrough(audit(() => empty())));
    await run([() => next(1), () => next(EOF)]);
    expect(await result).toEqual([]);
  });
});

describe("debounce()", () => {
  it("uses a per-value quiet period", async () => {
    const { observable, next } = external<string>();
    const result = collect(observable.pipeThrough(debounce((s) => timer(s.length * 10))));
    await run([() => next("a"), 5, () => next("bb"), 25, () => next("c"), () => next(EOF)]);
    expect(await result).toEqual(["bb", "c"]);
  });
});

describe("throttle()", () => {
  it("leading by default, trailing on request", async () => {
    const lead = external<number>();
    const leading = collect(lead.observable.pipeThrough(throttle(() => timer(10))));
    await run([
      () => lead.next(1),
      2,
      () => lead.next(2),
      10,
      () => lead.next(3),
      () => lead.next(EOF),
    ]);
    expect(await leading).toEqual([1, 3]);

    const trail = external<number>();
    const trailing = collect(
      trail.observable.pipeThrough(throttle(() => timer(10), { trailing: true })),
    );
    await run([() => trail.next(1), 2, () => trail.next(2), () => trail.next(EOF), 10]);
    expect(await trailing).toEqual([1, 2]);
  });
});

describe("delayWhen()", () => {
  it("delays each value by its own duration and drops silent ones", async () => {
    const { observable, next } = external<number>();
    const result = collect(
      observable.pipeThrough(delayWhen((n) => (n === 0 ? empty() : timer(n)))),
    );
    await run([() => next(30), () => next(10), () => next(0), () => next(EOF), 35]);
    expect(await result).toEqual([10, 30]);
  });
});

describe("sampleTime()", () => {
  it("emits the latest value each period", async () => {
    const { observable, next } = external<number>();
    const result = collect(observable.pipeThrough(sampleTime(10)));
    await run([() => next(1), () => next(2), 10, 10, () => next(3), 10, () => next(EOF)]);
    expect(await result).toEqual([2, 3]);
  });
});

describe("skipUntil()", () => {
  it("drops values until the notifier emits", async () => {
    const { observable, next } = external<number>();
    const notifier = external<null>();
    const result = collect(observable.pipeThrough(skipUntil(notifier.observable)));
    await run([() => next(1), () => notifier.next(null), () => next(2), () => next(EOF)]);
    expect(await result).toEqual([2]);
  });
});

describe("bufferTime()", () => {
  it("emits an array per period and the open one on completion", async () => {
    const { observable, next } = external<number>();
    const result = collect(observable.pipeThrough(bufferTime(10)));
    await run([() => next(1), () => next(2), 10, 10, () => next(3), () => next(EOF)]);
    expect(await result).toEqual([[1, 2], [], [3]]);
  });

  it("supports overlapping buffers and a size limit", async () => {
    const { observable, next } = external<number>();
    const result = collect(observable.pipeThrough(bufferTime(20, 10, 3)));
    await run([() => next(1), 10, () => next(2), 10, () => next(3), () => next(EOF)]);
    expect(await result).toEqual([[1, 2], [2, 3], [3]]);
  });
});

describe("bufferWhen() and bufferToggle()", () => {
  it("bufferWhen closes each buffer with a fresh closing stream", async () => {
    const { observable, next } = external<number>();
    const result = collect(observable.pipeThrough(bufferWhen(() => timer(10))));
    await run([() => next(1), 10, () => next(2), () => next(3), 10, () => next(EOF)]);
    expect(await result).toEqual([[1], [2, 3], []]);
  });

  it("bufferToggle buffers between openings and closings", async () => {
    const { observable, next } = external<number>();
    const openings = external<number>();
    const result = collect(
      observable.pipeThrough(bufferToggle(openings.observable, (ms) => timer(ms))),
    );
    await run([
      () => next(0),
      () => openings.next(20),
      () => next(1),
      10,
      () => openings.next(5),
      () => next(2),
      10,
      () => next(3),
      () => next(EOF),
    ]);
    expect(await result).toEqual([[2], [1, 2]]);
  });
});

describe("window variants", () => {
  it("windowTime closes overlapping windows early at the size limit", async () => {
    const { observable, next } = external<number>();
    const windows = collect(observable.pipeThrough(windowTime(100, 5, 2)));
    await run([() => next(1), 5, () => next(2), () => next(3), () => next(EOF)]);
    expect(await unwrap(windows)).toEqual([
      [1, 2],
      [2, 3],
    ]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("windowTime restarts size-limited windows with a negative creation interval", async () => {
    const { observable, next } = external<number>();
    const windows = collect(observable.pipeThrough(windowTime(100, -1, 1)));
    await run([() => next(1), () => next(2), () => next(EOF)]);
    expect(await unwrap(windows)).toEqual([[1], [2], []]);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("windowCount opens a window every n values", async () => {
    const { observable, next } = external<number>();
    const windows = collect(observable.pipeThrough(windowCount(2)));
    await run([() => next(1), () => next(2), () => next(3), () => next(4), () => next(EOF)]);
    expect(await unwrap(windows)).toEqual([[1, 2], [3, 4], []]);
  });

  it("windowCount overlaps with startWindowEvery", async () => {
    const { observable, next } = external<number>();
    const windows = collect(observable.pipeThrough(windowCount(2, 1)));
    await run([() => next(1), () => next(2), () => next(3), () => next(EOF)]);
    // As in RxJS, a window opens after every value, so the last one is empty.
    expect(await unwrap(windows)).toEqual([[1, 2], [2, 3], [3], []]);
  });

  it("windowTime closes windows by time", async () => {
    const { observable, next } = external<number>();
    const windows = collect(observable.pipeThrough(windowTime(10)));
    await run([() => next(1), 10, () => next(2), () => next(EOF)]);
    expect(await unwrap(windows)).toEqual([[1], [2]]);
  });

  it("windowWhen opens a new window when the closing stream emits or completes", async () => {
    const { observable, next } = external<number>();
    let round = 0;
    const windows = collect(
      observable.pipeThrough(
        windowWhen(() => (round++ === 0 ? timer(10) : timer(10).pipeThrough(ignoreElements()))),
      ),
    );
    await run([() => next(1), 10, () => next(2), () => next(EOF)]);
    const batches = await unwrap(windows);
    expect(batches[0]).toEqual([1]);
    expect(batches.flat()).toEqual([1, 2]);
  });

  it("windowToggle windows between openings and closings", async () => {
    const { observable, next } = external<number>();
    const openings = external<number>();
    const windows = collect(
      observable.pipeThrough(windowToggle(openings.observable, (ms) => timer(ms))),
    );
    await run([() => openings.next(10), () => next(1), 10, () => next(2), () => next(EOF)]);
    expect(await unwrap(windows)).toEqual([[1]]);
  });
});
