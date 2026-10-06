/** retry() delay policies: backoff schedules, retriable errors, delay streams, cancellation. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  backoff,
  collect,
  createStream,
  empty,
  HttpError,
  of,
  retry,
  throwError,
  timer,
} from "../../src/index.js";
import { marbles } from "../../src/testing/index.js";
import { waitTicks } from "../helpers.js";

beforeEach(() => {
  vi.useFakeTimers({ now: 0 });
});
afterEach(() => {
  vi.useRealTimers();
});

/** A factory that records when each attempt starts and always fails. */
const failingAttempts = (): { factory: () => ReadableStream<never>; starts: number[] } => {
  const starts: number[] = [];
  return { starts, factory: () => (starts.push(Date.now()), throwError(() => new Error("down"))) };
};
const gaps = (starts: number[]): number[] => starts.slice(1).map((t, i) => t - (starts[i] ?? 0));

describe("retry() with backoff()", () => {
  it("waits 100, 200, 400, 800, 1000, 1000 ms", async () => {
    const { factory, starts } = failingAttempts();
    const result = collect(
      retry(factory, { count: 6, delay: backoff({ baseMs: 100, factor: 2, maxMs: 1000 }) }),
    );
    const failed = expect(result).rejects.toThrow("down");
    await vi.advanceTimersByTimeAsync(10_000);
    await failed;
    expect(gaps(starts)).toEqual([100, 200, 400, 800, 1000, 1000]);
  });

  it("jitter keeps every wait between 0 and the schedule", () => {
    const schedule = backoff({ baseMs: 100, maxMs: 1000, jitter: true });
    for (let n = 1; n <= 6; n++) {
      const wait = schedule(undefined, n);
      expect(wait).toBeGreaterThanOrEqual(0);
      expect(wait).toBeLessThanOrEqual(Math.min(1000, 100 * 2 ** (n - 1)));
    }
    expect(() => backoff({ baseMs: 100, factor: 0.5 })).toThrow(RangeError);
  });

  it("plays out as marbles: values, waits, and the final error", async () => {
    const m = marbles({ advance: (ms) => vi.advanceTimersByTimeAsync(ms) });
    const boom = new Error("boom");
    await m.expect(
      retry(() => m.cold("a#", { a: 1 }, boom), { count: 2, delay: 10 }),
      "a-a-a#",
      { a: 1 },
      boom,
    );
  });
});

describe("retry() policy", () => {
  it("retriable: () => false fails after the first attempt", async () => {
    const { factory, starts } = failingAttempts();
    await expect(collect(retry(factory, { count: 5, retriable: () => false }))).rejects.toThrow(
      "down",
    );
    expect(starts).toHaveLength(1);
  });

  it("retries transient HTTP errors but not client errors", async () => {
    let attempts = 0;
    const statuses = [503, 400];
    const factory = (): ReadableStream<never> => {
      const status = statuses[attempts++] ?? 500;
      return throwError(() => new HttpError(new Response(null, { status })));
    };
    const result = collect(
      retry(factory, { count: 5, retriable: (e) => !(e instanceof HttpError && e.status < 500) }),
    );
    await expect(result).rejects.toMatchObject({ status: 400 });
    expect(attempts).toBe(2);
  });

  it("a delay function receives the error and 1-based retry number, and may throw to stop", async () => {
    const seen: [string, number][] = [];
    const result = collect(
      retry(() => throwError(() => new Error("x")), {
        count: 5,
        delay: (error, n) => {
          seen.push([(error as Error).message, n]);
          if (n === 3) throw new Error("gave up");
          return 0;
        },
      }),
    );
    await expect(result).rejects.toThrow("gave up");
    expect(seen).toEqual([
      ["x", 1],
      ["x", 2],
      ["x", 3],
    ]);
  });

  it("a delay stream triggers the retry; one that completes silently ends retry normally", async () => {
    const { factory, starts } = failingAttempts();
    const result = collect(
      retry(factory, { count: 5, delay: (_e, n) => (n === 1 ? timer(50) : empty()) }),
    );
    await vi.advanceTimersByTimeAsync(100);
    expect(await result).toEqual([]);
    expect(gaps(starts)).toEqual([50]);
  });

  it("resetOnSuccess restarts the count after a value", async () => {
    let attempt = 0;
    const factory = (): ReadableStream<number> =>
      createStream((s) => {
        attempt++;
        if (attempt % 2 === 0) s.next(attempt);
        s.error(new Error(`fail ${String(attempt)}`));
      });
    const result = collect(retry(factory, { count: 1, resetOnSuccess: true })).catch(
      (e: unknown) => e,
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(String(await result)).toMatch(/fail/);
    expect(attempt).toBeGreaterThan(2);
  });

  it("cancelling during a backoff wait starts no further attempt", async () => {
    const { factory, starts } = failingAttempts();
    const reader = retry(factory, { count: 5, delay: backoff({ baseMs: 100 }) }).getReader();
    void reader.read().catch(() => undefined);
    await waitTicks();
    expect(starts).toHaveLength(1);
    await reader.cancel("component disconnected");
    await vi.advanceTimersByTimeAsync(10_000);
    expect(starts).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("succeeds without retrying when the first attempt works", async () => {
    expect(
      await collect(retry(() => of(1, 2), { count: 3, delay: backoff({ baseMs: 100 }) })),
    ).toEqual([1, 2]);
  });
});
