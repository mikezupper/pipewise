/**
 * Cancelling while a read is still pending: every input must be cancelled
 * and its reader released.
 */
import { describe, expect, it } from "vitest";
import { defer, race, share, shareReplay, zip } from "../../src/index.js";
import { probe, waitTicks } from "../helpers.js";

describe("defer()", () => {
  it("cancels and releases the inner stream when cancelled mid-read", async () => {
    const inner = probe<number>();
    const reader = defer(() => inner.stream).getReader();
    const pending = reader.read();
    await waitTicks();
    expect(inner.stream.locked).toBe(true);
    await reader.cancel("stop");
    expect(inner.cancelled).toBe(true);
    expect(inner.stream.locked).toBe(false);
    expect(await pending).toEqual({ done: true, value: undefined });
  });
});

describe.each([
  { name: "race", combine: race },
  { name: "zip", combine: zip },
])("$name()", ({ combine }) => {
  it("cancels and releases every input when the consumer cancels mid-read", async () => {
    const inputs = [probe<number>(), probe<number>()];
    const reader = combine(
      inputs[0]?.stream ?? probe<number>().stream,
      inputs[1]?.stream ?? probe<number>().stream,
    ).getReader();
    void reader.read();
    await waitTicks();
    await reader.cancel("stop");
    await waitTicks();
    expect(inputs.map((p) => p.cancelled)).toEqual([true, true]);
    expect(inputs.map((p) => p.stream.locked)).toEqual([false, false]);
  });
});

it("race releases the winner when the consumer cancels after the race is decided", async () => {
  const winner = probe<number>();
  const loser = probe<number>();
  const reader = race(winner.stream, loser.stream).getReader();
  const first = reader.read();
  await waitTicks();
  winner.next(1);
  expect((await first).value).toBe(1);
  void reader.read();
  await waitTicks();
  await reader.cancel("stop");
  await waitTicks();
  expect([winner.cancelled, loser.cancelled]).toEqual([true, true]);
  expect([winner.stream.locked, loser.stream.locked]).toEqual([false, false]);
});

describe.each([
  { name: "share", branchOf: (s: ReadableStream<number>) => share(s) },
  {
    name: "shareReplay with refCount",
    branchOf: (s: ReadableStream<number>) => shareReplay(s, { refCount: true }),
  },
])("$name()", ({ branchOf }) => {
  it("cancels and releases the source when the last branch cancels mid-read", async () => {
    const source = probe<number>();
    const reader = branchOf(source.stream)().getReader();
    void reader.read();
    await waitTicks();
    expect(source.stream.locked).toBe(true);
    await reader.cancel("stop");
    await waitTicks();
    expect(source.cancelled).toBe(true);
    expect(source.stream.locked).toBe(false);
  });
});
