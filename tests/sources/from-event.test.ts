import { describe, expect, it, vi } from "vitest";
import { collect, fromEvent, take } from "../../src/index.js";
import { waitTicks } from "../helpers.js";

class CountingTarget extends EventTarget {
  listeners = 0;
  override addEventListener(...args: Parameters<EventTarget["addEventListener"]>): void {
    this.listeners++;
    super.addEventListener(...args);
  }
  override removeEventListener(...args: Parameters<EventTarget["removeEventListener"]>): void {
    this.listeners--;
    super.removeEventListener(...args);
  }
}

describe("fromEvent()", () => {
  it("once completes after one event and removes its listener", async () => {
    const target = new EventTarget();
    const remove = vi.spyOn(target, "removeEventListener");
    const result = collect(fromEvent(target, "ping", { once: true }));
    target.dispatchEvent(new Event("ping"));
    target.dispatchEvent(new Event("ping"));
    expect((await result).map((event) => event.type)).toEqual(["ping"]);
    expect(remove).toHaveBeenCalledOnce();
  });

  it("an already aborted signal completes without adding a listener", async () => {
    const target = new EventTarget();
    const add = vi.spyOn(target, "addEventListener");
    const control = new AbortController();
    control.abort();
    expect(await collect(fromEvent(target, "ping", { signal: control.signal }))).toEqual([]);
    expect(add).not.toHaveBeenCalled();
  });
  it("emits events", async () => {
    const target = new EventTarget();
    const reader = fromEvent<CustomEvent<number>>(target, "ping").getReader();
    target.dispatchEvent(new CustomEvent("ping", { detail: 1 }));
    target.dispatchEvent(new CustomEvent("ping", { detail: 2 }));
    expect((await reader.read()).value?.detail).toBe(1);
    expect((await reader.read()).value?.detail).toBe(2);
  });

  it("removes its listener when cancelled downstream", async () => {
    const target = new CountingTarget();
    const done = collect(fromEvent(target, "ping").pipeThrough(take(1)));
    expect(target.listeners).toBe(1);
    target.dispatchEvent(new Event("ping"));
    await done;
    await waitTicks();
    expect(target.listeners).toBe(0);
  });

  it("completes when options.signal aborts", async () => {
    const target = new CountingTarget();
    const controller = new AbortController();
    const done = collect(fromEvent(target, "ping", { signal: controller.signal }));
    target.dispatchEvent(new Event("ping"));
    controller.abort();
    expect(await done).toHaveLength(1);
    expect(target.listeners).toBe(0);
  });
});
