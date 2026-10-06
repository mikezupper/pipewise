import { describe, expect, it } from "vitest";
import { collect, share, take } from "../../src/index.js";
import { probe, waitTicks } from "../helpers.js";

describe("share()", () => {
  it("sends each value to every branch", async () => {
    const source = probe<number>();
    const branch = share(source.stream);
    const a = collect(branch());
    const b = collect(branch());
    await waitTicks();
    source.next(1);
    source.next(2);
    source.complete();
    expect(await a).toEqual([1, 2]);
    expect(await b).toEqual([1, 2]);
  });

  it("keeps running while any branch remains, then cancels the source", async () => {
    const source = probe<number>();
    const branch = share(source.stream);
    const short = collect(branch().pipeThrough(take(1)));
    const long = collect(branch().pipeThrough(take(2)));
    await waitTicks();
    source.next(1);
    await waitTicks();
    expect(await short).toEqual([1]);
    expect(source.cancelled).toBe(false);
    source.next(2);
    expect(await long).toEqual([1, 2]);
    await waitTicks();
    expect(source.cancelled).toBe(true);
  });

  it("errors every branch", async () => {
    const source = probe<number>();
    const branch = share(source.stream);
    const a = collect(branch());
    const b = collect(branch());
    await waitTicks();
    source.error(new Error("boom"));
    await expect(a).rejects.toThrow("boom");
    await expect(b).rejects.toThrow("boom");
  });
});
