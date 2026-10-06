import { afterEach, expect, it, vi } from "vitest";
import {
  bufferWhen,
  collect,
  groupBy,
  throttle,
  timeout,
  timer,
  windowWhen,
} from "../../src/index.js";
import { probe, waitTicks, type Probe } from "../helpers.js";
import type { Operator } from "../../src/types.js";

afterEach(() => vi.useRealTimers());

it("errors and cancels the source when a timeout fallback throws", async () => {
  vi.useFakeTimers();
  const source = probe<number>();
  const result = collect(
    source.stream.pipeThrough(
      timeout({
        each: 10,
        with: () => {
          throw new Error("fallback failed");
        },
      }),
    ),
  );
  const rejected = expect(result).rejects.toThrow("fallback failed");
  await vi.advanceTimersByTimeAsync(10);
  await rejected;
  expect(source.cancelled).toBe(true);
});

const closingOperators: ((selector: () => ReadableStream<unknown>) => Operator<number, unknown>)[] =
  [bufferWhen, windowWhen];
it.each(closingOperators)("errors when a later closing selector throws", async (make) => {
  vi.useFakeTimers();
  let calls = 0;
  const source = probe<number>();
  const result = collect(
    source.stream.pipeThrough(
      make(() => {
        if (calls++ > 0) throw new Error("closing failed");
        return timer(10);
      }),
    ),
  );
  const rejected = expect(result).rejects.toThrow("closing failed");
  await waitTicks();
  await vi.advanceTimersByTimeAsync(10);
  await rejected;
  expect(source.cancelled).toBe(true);
});

it("errors when a trailing throttle value's duration selector throws", async () => {
  vi.useFakeTimers();
  const source = probe<number>();
  const result = collect(
    source.stream.pipeThrough(
      throttle(
        (value) => {
          if (value === 2) throw new Error("duration failed");
          return timer(10);
        },
        { trailing: true },
      ),
    ),
  );
  const rejected = expect(result).rejects.toThrow("duration failed");
  source.next(1);
  source.next(2);
  await waitTicks();
  await vi.advanceTimersByTimeAsync(10);
  await rejected;
  expect(source.cancelled).toBe(true);
});

it("groupBy routes a duration error to its own group only, as RxJS does", async () => {
  const source = probe<number>();
  const durations = new Map<number, Probe<null>>();
  const output = source.stream.pipeThrough(
    groupBy((value: number) => value % 2, {
      duration: (group) => {
        const closing = probe<null>();
        durations.set(group.key, closing);
        return closing.stream;
      },
    }),
  );
  const groups: { key: number; values: Promise<number[]> }[] = [];
  const done = output.pipeTo(
    new WritableStream({
      write(group) {
        groups.push({ key: group.key, values: collect(group) });
      },
    }),
  );
  source.next(0);
  source.next(1);
  await waitTicks();
  durations.get(0)?.error(new Error("duration failed"));
  await waitTicks();
  source.next(3);
  source.next(4);
  source.complete();
  await done;

  const [even, odd, evenAgain] = groups;
  await expect(even?.values).rejects.toThrow("duration failed");
  expect(await odd?.values).toEqual([1, 3]);
  expect(evenAgain?.key).toBe(0);
  expect(await evenAgain?.values).toEqual([4]);
  expect(source.cancelled).toBe(false);
});
