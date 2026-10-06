import { describe, expect, it } from "vitest";
import { collect, csv, lines, ndjson, of, split } from "../../src/index.js";
import { expectChunkSafe } from "../helpers.js";

describe("split()", () => {
  it("splits on a multi-character separator across chunks", async () => {
    await expectChunkSafe("a::b::c", () => split("::"), ["a", "b", "c"]);
  });

  it("drops an empty trailing piece but keeps empty inner pieces", async () => {
    await expectChunkSafe("a,,b,", () => split(","), ["a", "", "b"]);
  });

  it("rejects an empty separator", () => {
    expect(() => split("")).toThrow(RangeError);
  });
});

describe("lines()", () => {
  it("handles \\n and \\r\\n, even when \\r\\n straddles chunks", async () => {
    await expectChunkSafe("one\r\ntwo\nthree", lines, ["one", "two", "three"]);
  });

  it("keeps blank lines and drops nothing but the final empty one", async () => {
    await expectChunkSafe("a\n\nb\n", lines, ["a", "", "b"]);
  });
});

describe("ndjson()", () => {
  it("delivers valid records before a malformed record in the same chunk", async () => {
    const reader = of("1\n2\n{invalid}\n").pipeThrough(ndjson()).getReader();
    expect((await reader.read()).value).toBe(1);
    expect((await reader.read()).value).toBe(2);
    await expect(reader.read()).rejects.toThrow(/line 3/);
    reader.releaseLock();
  });
  it("parses one value per line and skips blank lines", async () => {
    await expectChunkSafe('{"a":1}\n\n[2]\r\n"x"', () => ndjson(), [{ a: 1 }, [2], "x"]);
  });

  it("names the line number of invalid JSON", async () => {
    const parsed = collect(of('{"ok":1}\n', "\n", "{nope}\n").pipeThrough(ndjson()));
    await expect(parsed).rejects.toThrow(/line 3/);
  });

  it("applies a reviver", async () => {
    const dates = await collect(
      of('{"at":"2026-10-04"}').pipeThrough(
        ndjson<{ at: Date }>((k, v) => (k === "at" ? new Date(String(v)) : v)),
      ),
    );
    expect(dates[0]?.at).toBeInstanceOf(Date);
  });
});

describe("csv()", () => {
  it("parses rows, quotes, escaped quotes, and embedded newlines across chunks", async () => {
    await expectChunkSafe('id,note\r\n1,"a, ""b""\nc"\n2,', csv, [
      ["id", "note"],
      ["1", 'a, "b"\nc'],
      ["2", ""],
    ]);
  });

  it("skips empty lines and supports another separator", async () => {
    await expectChunkSafe("a;b\n\nc;d", () => csv({ separator: ";" }), [
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("emits header-keyed objects", async () => {
    await expectChunkSafe("id,name\n1,Ada\n2", () => csv({ header: true }), [
      { id: "1", name: "Ada" },
      { id: "2", name: "" },
    ]);
  });

  it("errors on an unterminated quote", async () => {
    await expect(collect(of('a,"open').pipeThrough(csv()))).rejects.toThrow(SyntaxError);
  });

  it("works on decoded bytes end to end", async () => {
    const bytes = new TextEncoder().encode("x,y\n1,2\n");
    const stream = new ReadableStream<Uint8Array<ArrayBuffer>>({
      start(c) {
        c.enqueue(bytes.slice(0, 5));
        c.enqueue(bytes.slice(5));
        c.close();
      },
    });
    expect(
      await collect(stream.pipeThrough(new TextDecoderStream()).pipeThrough(csv({ header: true }))),
    ).toEqual([{ x: "1", y: "2" }]);
  });
});
