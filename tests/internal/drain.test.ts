import { describe, expect, it, vi } from "vitest";
import { drain } from "../../src/internal/drain.js";
import { of } from "../../src/index.js";
import { probe, waitTicks } from "../helpers.js";

describe("drain lifecycle", () => {
  it.each(["callback", "ready"])("reports source errors while %s is pending", async (blocked) => {
    const source = probe<number>();
    const never = new Promise<void>(() => undefined);
    const result = drain(
      source.stream,
      () => (blocked === "callback" ? never : undefined),
      new AbortController().signal,
      blocked === "ready" ? () => never : undefined,
    );
    const rejected = expect(result).rejects.toThrow("upstream failed");
    source.next(1);
    await waitTicks();
    source.error(new Error("upstream failed"));
    await rejected;
    expect(source.stream.locked).toBe(false);
  });

  it.each(["callback", "ready"])(
    "cancels and releases a reader while %s is pending",
    async (blocked) => {
      const source = probe<number>();
      const control = new AbortController();
      const never = new Promise<void>(() => undefined);
      const result = drain(
        source.stream,
        () => (blocked === "callback" ? never : undefined),
        control.signal,
        blocked === "ready" ? () => never : undefined,
      );
      source.next(1);
      await waitTicks();
      control.abort("stop");
      await result;
      expect(source.cancelled).toBe(true);
      expect(source.stream.locked).toBe(false);
    },
  );

  it("cancels an already aborted input without invoking its callback", async () => {
    const source = probe<number>();
    const control = new AbortController();
    control.abort();
    const callback = vi.fn();
    await drain(source.stream, callback, control.signal);
    expect(callback).not.toHaveBeenCalled();
    expect(source.cancelled).toBe(true);
    expect(source.stream.locked).toBe(false);
  });

  it("cancels when a callback rejects, and waits for async work on normal close", async () => {
    const source = probe<number>();
    const failed = drain(
      source.stream,
      () => Promise.reject(new Error("callback failed")),
      new AbortController().signal,
    );
    source.next(1);
    await expect(failed).rejects.toThrow("callback failed");
    expect(source.cancelled).toBe(true);
    let finish!: () => void;
    const callback = new Promise<void>((resolve) => {
      finish = resolve;
    });
    let ended = false;
    const done = drain(of(1), () => callback, new AbortController().signal).then(() => {
      ended = true;
    });
    await waitTicks();
    expect(ended).toBe(false);
    finish();
    await done;
  });
});
