/**
 * Pins how many microtasks pass between a source value and the start of the
 * inner stream it maps to (docs/performance.md, "Start latency"). Web Streams
 * reads resolve promises, so the start cannot be synchronous; this test keeps
 * it from creeping up. Lower is fine: tighten the bounds when it improves.
 */
import { describe, expect, it } from "vitest";
import {
  concatMap,
  createStream,
  exhaustMap,
  external,
  mergeMap,
  switchMap,
  type Operator,
} from "../../src/index.js";
import { flushMicrotasks } from "../../src/testing/index.js";

type Flatten = (project: (value: number) => ReadableStream<never>) => Operator<number, never>;

const MAX_MICROTASKS: [string, Flatten, number][] = [
  ["mergeMap", (p) => mergeMap(p), 2],
  ["concatMap", (p) => concatMap(p), 2],
  ["switchMap", (p) => switchMap(p), 1],
  ["exhaustMap", (p) => exhaustMap(p), 2],
];

describe.each(MAX_MICROTASKS)("%s start latency", (_name, flatten, max) => {
  it(`starts the inner stream within ${String(max)} microtasks of the source value`, async () => {
    const { observable, next } = external<number>();
    // Read through a function: the producer sets it while this test awaits.
    const state = { started: false };
    const hasStarted = (): boolean => state.started;
    const reader = observable
      .pipeThrough(
        flatten(() =>
          createStream<never>(() => {
            state.started = true;
          }),
        ),
      )
      .getReader();
    void reader.read();
    await flushMicrotasks(50);
    next(1);
    let microtasks = 0;
    while (!hasStarted() && microtasks < 100) {
      await Promise.resolve();
      microtasks++;
    }
    expect(hasStarted()).toBe(true);
    expect(microtasks).toBeLessThanOrEqual(max);
    await reader.cancel();
  });

  it("has started after flushMicrotasks()", async () => {
    const { observable, next } = external<number>();
    let started = false;
    const reader = observable
      .pipeThrough(flatten(() => createStream<never>(() => void (started = true))))
      .getReader();
    void reader.read();
    next(1);
    await flushMicrotasks();
    expect(started).toBe(true);
    await reader.cancel();
  });
});
