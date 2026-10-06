import { describe, expect, it } from "vitest";
import { collect, fromAsyncFunction, fromPromise } from "../../src/index.js";

describe("fromPromise()", () => {
  it("emits the resolved value", async () => {
    expect(await collect(fromPromise(Promise.resolve(42)))).toEqual([42]);
  });

  it("errors on rejection", async () => {
    await expect(collect(fromPromise(Promise.reject(new Error("no"))))).rejects.toThrow("no");
  });
});

describe("fromAsyncFunction()", () => {
  it("emits the returned value", async () => {
    expect(await collect(fromAsyncFunction(() => Promise.resolve("ok")))).toEqual(["ok"]);
  });

  it("aborts the signal when cancelled", async () => {
    let signal: AbortSignal | undefined;
    const stream = fromAsyncFunction((s) => {
      signal = s;
      return new Promise<never>(() => undefined);
    });
    await stream.cancel();
    expect(signal?.aborted).toBe(true);
  });
});
