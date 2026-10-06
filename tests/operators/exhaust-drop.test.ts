/** exhaustMap/exhaustAll: reporting dropped values and never starting their work. */
import { describe, expect, it, vi } from "vitest";
import { collect, createStream, EOF, exhaustAll, exhaustMap, external } from "../../src/index.js";
import { probe, waitTicks } from "../helpers.js";

describe("exhaustMap onDrop", () => {
  it("reports exactly the values ignored while an inner stream is active, in order", async () => {
    const inner = probe<string>();
    const outer = external<number>();
    const dropped: [number, number][] = [];
    const project = vi.fn(() => inner.stream);
    const result = collect(
      outer.observable.pipeThrough(
        exhaustMap(project, {
          onDrop: (v, i) => {
            dropped.push([v, i]);
          },
        }),
      ),
    );
    outer.next(10);
    await waitTicks();
    outer.next(20);
    outer.next(30);
    outer.next(40);
    await waitTicks();
    expect(dropped).toEqual([
      [20, 1],
      [30, 2],
      [40, 3],
    ]);
    inner.next("done");
    inner.complete();
    outer.next(EOF);
    expect(await result).toEqual(["done"]);
    expect(project).toHaveBeenCalledTimes(1);
  });

  it("never reports a value that started an inner stream, and never starts work for a dropped one", async () => {
    const started: number[] = [];
    const dropped: number[] = [];
    const outer = external<number>();
    const releases: (() => void)[] = [];
    const result = collect(
      outer.observable.pipeThrough(
        exhaustMap(
          (v: number) =>
            createStream<number>((s) => {
              started.push(v);
              releases.push(() => {
                s.next(v);
                s.complete();
              });
            }),
          {
            onDrop: (v) => {
              dropped.push(v);
            },
          },
        ),
      ),
    );
    outer.next(1);
    await waitTicks();
    outer.next(2);
    await waitTicks();
    releases.shift()?.();
    await waitTicks();
    outer.next(3);
    await waitTicks();
    releases.shift()?.();
    outer.next(EOF);
    expect(await result).toEqual([1, 3]);
    expect(started).toEqual([1, 3]);
    expect(dropped).toEqual([2]);
  });

  it("an onDrop that throws errors the stream", async () => {
    const outer = external<number>();
    const result = collect(
      outer.observable.pipeThrough(
        exhaustMap(() => probe<number>().stream, {
          onDrop: () => {
            throw new Error("onDrop failed");
          },
        }),
      ),
    );
    outer.next(1);
    await waitTicks();
    outer.next(2);
    await expect(result).rejects.toThrow("onDrop failed");
  });
});

describe("exhaustAll onDrop", () => {
  it("reports and cancels each ignored inner stream", async () => {
    const active = probe<number>();
    const ignored = [probe<number>(), probe<number>()];
    const outer = external<ReadableStream<number>>();
    const reported: ReadableStream<number>[] = [];
    const result = collect(
      outer.observable.pipeThrough(
        exhaustAll<number>({
          onDrop: (inner) => {
            reported.push(inner);
          },
        }),
      ),
    );
    outer.next(active.stream);
    await waitTicks();
    for (const p of ignored) outer.next(p.stream);
    await waitTicks();
    expect(reported).toEqual(ignored.map((p) => p.stream));
    expect(ignored.map((p) => p.cancelled)).toEqual([true, true]);
    active.complete();
    outer.next(EOF);
    expect(await result).toEqual([]);
  });
});
