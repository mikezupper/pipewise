import { describe, expect, it } from "vitest";
import { collect, inWorker, range } from "../../src/index.js";

describe.runIf(typeof Worker !== "undefined")("inWorker() with a real Web Worker", () => {
  it("runs the stage on another thread", async () => {
    const worker = new Worker(new URL("./fixtures/double.worker.ts", import.meta.url), {
      type: "module",
    });
    try {
      const result = await collect(
        range(1, 1000).pipeThrough(inWorker<number, number>(worker, "double")),
      );
      expect(result).toHaveLength(1000);
      expect(result.at(-1)).toBe(2000);
    } finally {
      worker.terminate();
    }
  });
});
