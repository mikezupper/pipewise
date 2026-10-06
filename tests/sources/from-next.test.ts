import { describe, expect, it } from "vitest";
import { collect, EOF, fromNext } from "../../src/index.js";

describe("fromNext()", () => {
  it("passes next to the callback", async () => {
    const stream = fromNext<number>((next) => {
      next(1);
      next(2);
      next(EOF);
    });
    expect(await collect(stream)).toEqual([1, 2]);
  });
});
