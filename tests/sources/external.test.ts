import { describe, expect, it } from "vitest";
import { collect, EOF, external } from "../../src/index.js";

describe("external()", () => {
  it("emits values pushed with next", async () => {
    const { observable, next } = external<number>();
    next(1);
    next(2);
    next(EOF);
    expect(await collect(observable)).toEqual([1, 2]);
  });

  it("supports complete() and error()", async () => {
    const a = external<number>();
    a.next(1);
    a.complete();
    expect(await collect(a.observable)).toEqual([1]);
    const b = external<number>();
    b.error(new Error("boom"));
    await expect(collect(b.observable)).rejects.toThrow("boom");
  });

  it("ignores next after cancel instead of throwing", async () => {
    const { observable, next } = external<number>();
    await observable.cancel();
    expect(() => {
      next(1);
    }).not.toThrow();
  });
});
