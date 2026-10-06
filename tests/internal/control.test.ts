import { afterEach, expect, it, vi } from "vitest";
import { childController } from "../../src/internal/child-signal.js";
import { messageOf, postSafely } from "../../src/internal/port-protocol.js";
import { sleep } from "../../src/internal/sleep.js";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("child signals inherit abort reasons and detach when cancelled independently", () => {
  const parent = new AbortController();
  const remove = vi.spyOn(parent.signal, "removeEventListener");
  const child = childController(parent.signal);
  child.abort("child stopped");
  expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  parent.abort("parent stopped");
  expect(child.signal.reason).toBe("child stopped");
  expect(childController(parent.signal).signal.reason).toBe("parent stopped");
});

it("sleep on an already aborted signal creates no timer", async () => {
  vi.useFakeTimers();
  const control = new AbortController();
  control.abort();
  await sleep(100, control.signal);
  expect(vi.getTimerCount()).toBe(0);
});

it("port errors and cancellation fall back to text when a reason cannot be cloned", () => {
  for (const pw of ["error", "cancel"] as const) {
    const port = {
      postMessage: vi.fn().mockImplementationOnce(() => {
        throw new Error("clone failed");
      }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    expect(postSafely(port, { pw, reason: "uncloneable" })).toBe(false);
    expect(port.postMessage).toHaveBeenLastCalledWith({ pw, reason: "uncloneable" });
  }
  expect(messageOf(new MessageEvent("message", { data: null }))).toBeUndefined();
  expect(messageOf(new MessageEvent("message", { data: { unrelated: true } }))).toBeUndefined();
});
