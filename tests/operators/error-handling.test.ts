import { describe, expect, it, vi } from "vitest";
import { catchError, collect, concat, createStream, finalize, of, take } from "../../src/index.js";
import { probe, waitTicks } from "../helpers.js";

const failing = <T>(...values: T[]): ReadableStream<T> =>
  createStream<T>((s) => {
    for (const v of values) s.next(v);
    s.error(new Error("boom"));
  });

describe("catchError()", () => {
  it("switches to the fallback after an error", async () => {
    const result = await collect(failing(1, 2).pipeThrough(catchError(() => of(99))));
    expect(result).toEqual([1, 2, 99]);
  });

  it("passes the error to the handler", async () => {
    let caught: unknown;
    await collect(
      failing<number>().pipeThrough(
        catchError((error) => {
          caught = error;
          return of<number>();
        }),
      ),
    );
    expect(caught).toBeInstanceOf(Error);
  });

  it("is transparent when the source succeeds", async () => {
    expect(await collect(of(1).pipeThrough(catchError(() => of(2))))).toEqual([1]);
  });
});

describe("finalize()", () => {
  it("runs once on completion", async () => {
    const f = vi.fn();
    await collect(of(1, 2).pipeThrough(finalize(f)));
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("runs once on error", async () => {
    const f = vi.fn();
    await expect(collect(failing(1).pipeThrough(finalize(f)))).rejects.toThrow();
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("runs once on downstream cancellation and cancels the source", async () => {
    const f = vi.fn();
    const source = probe<number>();
    const result = collect(source.stream.pipeThrough(finalize(f)).pipeThrough(take(1)));
    await waitTicks();
    source.next(1);
    await result;
    await waitTicks();
    expect(f).toHaveBeenCalledTimes(1);
    expect(source.cancelled).toBe(true);
  });

  it("works across concatenation", async () => {
    const f = vi.fn();
    await collect(concat(of(1).pipeThrough(finalize(f)), of(2)));
    expect(f).toHaveBeenCalledTimes(1);
  });
});
