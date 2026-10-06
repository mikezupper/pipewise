import { describe, expect, it, vi } from "vitest";
import { collect, createStream } from "../../src/index.js";
import { waitTicks } from "../helpers.js";

describe("createStream()", () => {
  it("reports teardown errors after both synchronous completion and cancellation", async () => {
    const scheduled: VoidFunction[] = [];
    const report = vi.spyOn(globalThis, "queueMicrotask").mockImplementation((callback) => {
      scheduled.push(callback);
    });
    const reason = new Error("teardown failed");
    const teardown = (): void => {
      throw reason;
    };
    try {
      const completed = createStream((s) => {
        s.complete();
        return teardown;
      });
      await createStream(() => teardown).cancel();
      expect(await collect(completed)).toEqual([]);
      expect(scheduled).toHaveLength(2);
      for (const callback of scheduled) expect(callback).toThrow(reason);
    } finally {
      report.mockRestore();
    }
  });
  it("emits values and completes", async () => {
    const stream = createStream<number>((s) => {
      s.next(1);
      s.next(2);
      s.complete();
    });
    expect(await collect(stream)).toEqual([1, 2]);
  });

  it("ignores calls after the stream ends", async () => {
    const stream = createStream<number>((s) => {
      s.next(1);
      s.complete();
      s.next(2);
      s.error(new Error("late"));
    });
    expect(await collect(stream)).toEqual([1]);
  });

  it("runs teardown once on cancel and aborts the signal", async () => {
    const teardown = vi.fn();
    let signal: AbortSignal | undefined;
    const stream = createStream<number>((s) => {
      signal = s.signal;
      return teardown;
    });
    await stream.cancel("bye");
    expect(teardown).toHaveBeenCalledTimes(1);
    expect(signal?.aborted).toBe(true);
    expect(signal?.reason).toBe("bye");
  });

  it("runs teardown on completion", () => {
    const teardown = vi.fn();
    const stream = createStream<number>((s) => {
      queueMicrotask(() => {
        s.complete();
      });
      return teardown;
    });
    return collect(stream).then(() => {
      expect(teardown).toHaveBeenCalledTimes(1);
    });
  });

  it("errors when the producer throws or rejects", async () => {
    await expect(
      collect(
        createStream(() => {
          throw new Error("sync");
        }),
      ),
    ).rejects.toThrow("sync");
    await expect(collect(createStream(() => Promise.reject(new Error("async"))))).rejects.toThrow(
      "async",
    );
  });

  it("ready() waits for a reader", async () => {
    let ready = false;
    const stream = createStream<number>(async (s) => {
      await s.ready();
      ready = true;
      s.next(1);
    });
    await waitTicks();
    expect(ready).toBe(false);
    const reader = stream.getReader();
    expect((await reader.read()).value).toBe(1);
    expect(ready).toBe(true);
  });
});
