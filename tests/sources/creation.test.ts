import { describe, expect, it, vi } from "vitest";
import {
  collect,
  createStream,
  defer,
  empty,
  firstValueFrom,
  from,
  fromEventPattern,
  fromSubscribable,
  generate,
  iif,
  never,
  of,
  onErrorResumeNext,
  partition,
  repeat,
  shareReplay,
  take,
  throwError,
  using,
  type PatternHandler,
} from "../../src/index.js";
import { probe, waitTicks } from "../helpers.js";

describe("defer()", () => {
  it("calls the factory on first read, not before", async () => {
    const factory = vi.fn(() => of(1, 2));
    const stream = defer(factory);
    await waitTicks();
    expect(factory).not.toHaveBeenCalled();
    expect(await collect(stream)).toEqual([1, 2]);
    expect(factory).toHaveBeenCalledOnce();
  });

  it("cancels the inner stream when cancelled", async () => {
    const inner = probe<number>();
    const reader = defer(() => inner.stream).getReader();
    void reader.read();
    await waitTicks();
    await reader.cancel();
    expect(inner.cancelled).toBe(true);
  });
});

describe("empty(), never(), throwError()", () => {
  it("empty completes at once", async () => {
    expect(await collect(empty())).toEqual([]);
  });

  it("never stays open until cancelled", async () => {
    let settled = false;
    const stream = never();
    void collect(stream).finally(() => (settled = true));
    await waitTicks();
    expect(settled).toBe(false);
  });

  it("throwError errors lazily with the factory's value", async () => {
    const factory = vi.fn(() => new Error("nope"));
    const stream = throwError(factory);
    expect(factory).not.toHaveBeenCalled();
    await expect(collect(stream)).rejects.toThrow("nope");
  });
});

describe("iif()", () => {
  it("chooses by condition and cancels the other stream", async () => {
    const other = probe<string>();
    expect(await collect(iif(() => true, of("yes"), other.stream))).toEqual(["yes"]);
    expect(other.cancelled).toBe(true);
    expect(await collect(iif(() => false, probe<string>().stream, of("no")))).toEqual(["no"]);
  });
});

describe("generate()", () => {
  it("works like a for loop", async () => {
    const stream = generate({ initialState: 1, condition: (n) => n <= 8, iterate: (n) => n * 2 });
    expect(await collect(stream)).toEqual([1, 2, 4, 8]);
  });

  it("maps states and can run forever", async () => {
    const stream = generate({
      initialState: 0,
      iterate: (n) => n + 1,
      resultSelector: (n) => `#${String(n)}`,
    });
    expect(await collect(stream.pipeThrough(take(2)))).toEqual(["#0", "#1"]);
  });
});

describe("from()", () => {
  it("converts each kind of input", async () => {
    async function* gen(): AsyncGenerator<number> {
      yield await Promise.resolve(1);
    }
    const stream = of(9);
    expect(from(stream)).toBe(stream);
    expect(await collect(from([1, 2]))).toEqual([1, 2]);
    expect(await collect(from(Promise.resolve(3)))).toEqual([3]);
    expect(await collect(from(gen()))).toEqual([1]);
  });

  it("rejects other inputs", () => {
    expect(() => from(42 as unknown as number[])).toThrow(TypeError);
  });
});

describe("fromEventPattern()", () => {
  it("adds a handler, emits calls, and removes it with the token on cancel", async () => {
    let handler: PatternHandler | undefined;
    const remove = vi.fn();
    const stream = fromEventPattern<number | unknown[]>((h) => {
      handler = h;
      return "token";
    }, remove);
    const reader = stream.getReader();
    handler?.(1);
    handler?.("a", "b");
    expect((await reader.read()).value).toBe(1);
    expect((await reader.read()).value).toEqual(["a", "b"]);
    await reader.cancel();
    expect(remove).toHaveBeenCalledWith(handler, "token");
  });
});

describe("fromSubscribable()", () => {
  it("adapts an RxJS-style observable and unsubscribes on cancel", async () => {
    const unsubscribe = vi.fn();
    const result = await collect(
      fromSubscribable<number>({
        subscribe(observer) {
          observer.next(1);
          observer.next(2);
          return { unsubscribe };
        },
      }).pipeThrough(take(2)),
    );
    expect(result).toEqual([1, 2]);
    await waitTicks();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("forwards completion and errors", async () => {
    const done = fromSubscribable<number>({
      subscribe(o) {
        o.next(1);
        o.complete();
        return undefined;
      },
    });
    expect(await collect(done)).toEqual([1]);
    const failed = fromSubscribable<number>({
      subscribe(o) {
        o.error(new Error("x"));
        return () => undefined;
      },
    });
    await expect(collect(failed)).rejects.toThrow("x");
  });
});

describe("partition()", () => {
  it("splits values by predicate", async () => {
    const [evens, odds] = partition(of(1, 2, 3, 4), (n) => n % 2 === 0);
    expect(await Promise.all([collect(evens), collect(odds)])).toEqual([
      [2, 4],
      [1, 3],
    ]);
  });
});

describe("using()", () => {
  it("disposes the resource once on completion", async () => {
    const dispose = vi.fn();
    const result = await collect(
      using(
        () => ({ unsubscribe: dispose }),
        () => of(1),
      ),
    );
    expect(result).toEqual([1]);
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("disposes on error and on cancel", async () => {
    const onError = vi.fn();
    await expect(
      collect(
        using(
          () => ({ unsubscribe: onError }),
          () => throwError(() => new Error("e")),
        ),
      ),
    ).rejects.toThrow();
    expect(onError).toHaveBeenCalledOnce();
    const onCancel = vi.fn();
    await firstValueFrom(
      using(
        () => ({ unsubscribe: onCancel }),
        () => of(1, 2, 3),
      ),
    );
    await waitTicks();
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

describe("repeat()", () => {
  it("reads count fresh streams", async () => {
    let round = 0;
    expect(await collect(repeat(() => of(round++), { count: 3 }))).toEqual([0, 1, 2]);
    expect(await collect(repeat(() => of(1), { count: 0 }))).toEqual([]);
  });

  it("stops on error", async () => {
    await expect(
      collect(repeat(() => throwError(() => new Error("stop")), { count: 3 })),
    ).rejects.toThrow("stop");
  });
});

describe("shareReplay()", () => {
  it("replays the last bufferSize values to late branches", async () => {
    const source = probe<number>();
    const branch = shareReplay(source.stream, { bufferSize: 2 });
    const early = collect(branch());
    await waitTicks();
    source.next(1);
    source.next(2);
    source.next(3);
    await waitTicks();
    const late = branch().getReader();
    expect((await late.read()).value).toBe(2);
    expect((await late.read()).value).toBe(3);
    source.complete();
    expect(await early).toEqual([1, 2, 3]);
    expect((await late.read()).done).toBe(true);
  });

  it("replays then completes for branches created after the source ends", async () => {
    const branch = shareReplay(of(1, 2), { bufferSize: 1 });
    expect(await collect(branch())).toEqual([1, 2]);
    expect(await collect(branch())).toEqual([2]);
  });

  it("keeps the source running with no branches unless refCount", async () => {
    const kept = probe<number>();
    const first = firstValueFrom(shareReplay(kept.stream)());
    await waitTicks();
    kept.next(1);
    expect(await first).toBe(1);
    await waitTicks();
    expect(kept.cancelled).toBe(false);
    const counted = probe<number>();
    const reader = shareReplay(counted.stream, { refCount: true })().getReader();
    await waitTicks();
    await reader.cancel();
    await waitTicks();
    expect(counted.cancelled).toBe(true);
  });

  it("replays errors", async () => {
    const branch = shareReplay(createStream<number>((s) => s.error(new Error("x"))));
    await expect(collect(branch())).rejects.toThrow("x");
    await expect(collect(branch())).rejects.toThrow("x");
  });
});

describe("onErrorResumeNext()", () => {
  it("moves past errors and completes", async () => {
    const failing = createStream<number>((s) => {
      s.next(1);
      s.error(new Error("skip me"));
    });
    expect(
      await collect(
        onErrorResumeNext(
          failing,
          of(2),
          throwError(() => 0),
          of(3),
        ),
      ),
    ).toEqual([1, 2, 3]);
  });
});

describe("using() with Symbol.dispose", () => {
  it.runIf(typeof (Symbol as { dispose?: symbol }).dispose === "symbol")(
    "prefers [Symbol.dispose]()",
    async () => {
      const dispose = vi.fn();
      const unsubscribe = vi.fn();
      const key = (Symbol as unknown as { dispose: symbol }).dispose;
      await collect(
        using(
          () => ({ [key]: dispose, unsubscribe }),
          () => of(1),
        ),
      );
      expect(dispose).toHaveBeenCalledOnce();
      expect(unsubscribe).not.toHaveBeenCalled();
    },
  );
});
