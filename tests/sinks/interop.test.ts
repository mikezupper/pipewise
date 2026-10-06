import {
  type ObservableInput,
  from as rxFrom,
  firstValueFrom as rxFirst,
  interval as rxInterval,
  lastValueFrom as rxLast,
  map as rxMap,
  toArray as rxToArray,
} from "rxjs";
import { describe, expect, it, vi } from "vitest";
import {
  collect,
  createStream,
  fromSubscribable,
  of,
  take,
  toSubscribable,
} from "../../src/index.js";
import { probe, waitTicks } from "../helpers.js";

/**
 * RxJS's types key interop on its global `Symbol.observable` declaration, which
 * pipewise does not publish, so TypeScript needs a cast. At runtime RxJS finds
 * the `@@observable` method, which is what these tests check.
 */
const rx = <T>(source: ReturnType<typeof toSubscribable<T>>): ObservableInput<T> =>
  source as unknown as ObservableInput<T>;

describe("RxJS and plain streams", () => {
  it("RxJS from() accepts a pipewise stream directly", async () => {
    expect(await rxLast(rxFrom(of(1, 2, 3)).pipe(rxToArray()))).toEqual([1, 2, 3]);
  });
});

describe("toSubscribable() with RxJS", () => {
  it("RxJS from() consumes a pipewise stream", async () => {
    const result = await rxLast(
      rxFrom(rx(toSubscribable(of(1, 2, 3)))).pipe(
        rxMap((n) => n * 10),
        rxToArray(),
      ),
    );
    expect(result).toEqual([10, 20, 30]);
  });

  it("unsubscribing in RxJS cancels the stream", async () => {
    const source = probe<number>();
    const first = rxFirst(rxFrom(rx(toSubscribable(source.stream))));
    await waitTicks();
    source.next(1);
    expect(await first).toBe(1);
    await waitTicks();
    expect(source.cancelled).toBe(true);
  });

  it("forwards errors", async () => {
    const failing = createStream<number>((s) => {
      s.error(new Error("boom"));
    });
    await expect(rxLast(rxFrom(rx(toSubscribable(failing))))).rejects.toThrow("boom");
  });

  it("round-trips RxJS → pipewise → RxJS", async () => {
    const piped = fromSubscribable(rxInterval(1)).pipeThrough(take(3));
    expect(await rxLast(rxFrom(rx(toSubscribable(piped))).pipe(rxToArray()))).toEqual([0, 1, 2]);
  });
});

describe("toSubscribable() semantics", () => {
  it("a factory gives each subscriber a fresh stream", async () => {
    const shared = toSubscribable(() => of("a", "b"));
    const [x, y] = await Promise.all([
      rxLast(rxFrom(rx(shared)).pipe(rxToArray())),
      rxLast(rxFrom(rx(shared)).pipe(rxToArray())),
    ]);
    expect([x, y]).toEqual([
      ["a", "b"],
      ["a", "b"],
    ]);
  });

  it("a plain stream refuses a second subscriber with a clear error", () => {
    const once = toSubscribable(of(1));
    once.subscribe();
    const error = vi.fn();
    const second = once.subscribe({ error });
    expect(second.closed).toBe(true);
    expect(String(error.mock.calls[0]?.[0])).toMatch(/pass a factory/);
    expect(() => {
      second.unsubscribe();
    }).not.toThrow();
  });

  it("reports exceptions from observer callbacks instead of sending them to error", async () => {
    const error = vi.fn();
    const seen: number[] = [];
    const reported: unknown[] = [];
    const onError = (e: unknown): void => void reported.push(e);
    if (typeof process !== "undefined") process.on("uncaughtException", onError);
    else globalThis.addEventListener("error", (e) => e.preventDefault(), { once: true });
    toSubscribable(of(1, 2)).subscribe({
      next: (v) => {
        seen.push(v);
        if (v === 1) throw new Error("observer bug");
      },
      error,
    });
    await waitTicks(40);
    if (typeof process !== "undefined") process.off("uncaughtException", onError);
    expect(seen).toEqual([1, 2]);
    expect(error).not.toHaveBeenCalled();
  });

  it("is still readable by pipewise after the round trip", async () => {
    expect(await collect(fromSubscribable(toSubscribable(of(1, 2))))).toEqual([1, 2]);
  });
});
