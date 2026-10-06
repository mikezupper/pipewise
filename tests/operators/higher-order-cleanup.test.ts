import { describe, expect, it } from "vitest";
import {
  combineLatestAll,
  concatAll,
  exhaustAll,
  mergeAll,
  switchAll,
  zipAll,
} from "../../src/index.js";
import { probe, waitTicks, type Probe } from "../helpers.js";

/**
 * Streams-of-streams operators must cancel every inner stream they were
 * handed, including ones still waiting in a buffer when the output is cancelled.
 */
describe.each([
  { name: "concatAll", op: () => concatAll<number>() },
  { name: "mergeAll(1)", op: () => mergeAll<number>(1) },
  { name: "exhaustAll", op: () => exhaustAll<number>() },
  { name: "switchAll", op: () => switchAll<number>() },
  { name: "combineLatestAll", op: () => combineLatestAll<number>() },
  { name: "zipAll", op: () => zipAll<number>() },
])("$name cleanup", ({ op }) => {
  it("cancels every inner stream it received when the output is cancelled", async () => {
    const outer = probe<ReadableStream<number>>();
    const inners: Probe<number>[] = [probe(), probe(), probe()];
    const reader = outer.stream.pipeThrough<unknown>(op()).getReader();
    void reader.read().catch(() => undefined);
    for (const inner of inners) {
      outer.next(inner.stream);
      await waitTicks();
    }
    await reader.cancel("stop");
    await waitTicks();
    expect(inners.map((p) => p.cancelled)).toEqual([true, true, true]);
  });
});
