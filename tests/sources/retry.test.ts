import { describe, expect, it } from "vitest";
import { collect, createStream, retry } from "../../src/index.js";

function failing(times: number): () => ReadableStream<number> {
  let attempt = 0;
  return () =>
    createStream<number>((s) => {
      s.next(attempt);
      if (attempt++ < times) s.error(new Error(`attempt ${String(attempt)}`));
      else s.complete();
    });
}

describe("retry()", () => {
  it("resubscribes via the factory until it succeeds", async () => {
    expect(await collect(retry(failing(2), { count: 3 }))).toEqual([0, 1, 2]);
  });

  it("gives up after count retries", async () => {
    await expect(collect(retry(failing(5), { count: 1 }))).rejects.toThrow("attempt 2");
  });
});
