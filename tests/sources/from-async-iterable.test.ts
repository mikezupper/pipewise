import { describe, expect, it } from "vitest";
import { collect, fromAsyncIterable, take } from "../../src/index.js";
import { waitTicks } from "../helpers.js";

describe("fromAsyncIterable()", () => {
  it("emits values and calls return() on cancel", async () => {
    let cleanedUp = false;
    async function* naturals(): AsyncGenerator<number> {
      try {
        for (let i = 0; ; i++) yield await Promise.resolve(i);
      } finally {
        cleanedUp = true;
      }
    }
    expect(await collect(fromAsyncIterable(naturals()).pipeThrough(take(2)))).toEqual([0, 1]);
    await waitTicks();
    expect(cleanedUp).toBe(true);
  });
});
