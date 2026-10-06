import { expect, it } from "vitest";
import {
  collect,
  createStream,
  empty,
  expand,
  mergeMap,
  take,
  of,
  range,
  sequenceEqual,
  skipLast,
  takeLast,
} from "../../src/index.js";
import { probe, waitTicks } from "../helpers.js";

it("drains large queued bursts in order, including values queued before an error", async () => {
  const source = createStream<number>((subscriber) => {
    for (let i = 0; i < 4096; i++) subscriber.next(i);
    subscriber.error(new Error("after burst"));
  });
  const reader = source.getReader();
  for (let i = 0; i < 4096; i++) expect((await reader.read()).value).toBe(i);
  await expect(reader.read()).rejects.toThrow("after burst");
  reader.releaseLock();
});

it("keeps rolling tails in order through several queue compactions", async () => {
  expect(await collect(range(0, 4096).pipeThrough(takeLast(1024)))).toEqual(
    Array.from({ length: 1024 }, (_, i) => i + 3072),
  );
  expect(await collect(range(0, 4096).pipeThrough(skipLast(1024)))).toEqual(
    Array.from({ length: 3072 }, (_, i) => i),
  );
});

it.each([true, false])(
  "sequenceEqual keeps comparator argument order when primary first is %s",
  async (primaryFirst) => {
    const primary = probe<number>();
    const other = probe<number>();
    const result = collect(
      primary.stream.pipeThrough(sequenceEqual(other.stream, (a, b) => a + 1 === b)),
    );
    (primaryFirst ? primary : other).next(primaryFirst ? 1 : 2);
    await waitTicks();
    (primaryFirst ? other : primary).next(primaryFirst ? 2 : 1);
    primary.complete();
    other.complete();
    expect(await result).toEqual([true]);
  },
);

it("expand drains waiting projections with finite concurrency", async () => {
  expect(
    await collect(of(1, 2).pipeThrough(expand((n) => (n < 3 ? of(n + 10) : empty()), 1))),
  ).toEqual([1, 11, 2, 12]);
  for (const concurrent of [0, -1, NaN])
    expect(() => expand(() => empty(), concurrent)).toThrow(RangeError);
});

it("expand reports a queued projection exception", async () => {
  const outer = probe<number>();
  const inner = probe<number>();
  const result = collect(
    outer.stream.pipeThrough(
      expand((value) => {
        if (value === 2) throw new Error("queued projection failed");
        return inner.stream;
      }, 1),
    ),
  );
  const rejected = expect(result).rejects.toThrow("queued projection failed");
  outer.next(1);
  await waitTicks();
  outer.next(2);
  await waitTicks();
  outer.complete();
  inner.complete();
  await rejected;
});

it("mergeMap keeps recycling a finite slot while another inner stream stays open", async () => {
  const slow = probe<number>();
  const result = await collect(
    range(0, 1025)
      .pipeThrough(mergeMap((value) => (value === 0 ? slow.stream : of(value)), 2))
      .pipeThrough(take(1024)),
  );
  expect(result).toEqual(Array.from({ length: 1024 }, (_, i) => i + 1));
  await waitTicks();
  expect(slow.cancelled).toBe(true);
});
