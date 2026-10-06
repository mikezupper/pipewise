import { describe, expect, it, vi } from "vitest";
import {
  collect,
  createStream,
  filter,
  inWorker,
  map,
  of,
  receiveStream,
  sendStream,
  serveOperators,
  take,
} from "../../src/index.js";
import { probe, waitTicks } from "../helpers.js";

/** Settles the message ports, which deliver on the task queue, not microtasks. */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));

describe("sendStream() and receiveStream()", () => {
  it("reports source errors without waiting for a read credit and releases its reader", async () => {
    const source = probe<number>();
    const port = {
      postMessage: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      close: vi.fn(),
    };
    const sent = sendStream(source.stream, port);
    const reason = new Error("idle error");
    source.error(reason);
    await sent;
    expect(port.postMessage).toHaveBeenCalledWith({ pw: "error", reason }, []);
    expect(source.stream.locked).toBe(false);
    expect(port.close).toHaveBeenCalledOnce();
  });

  it("releases its source reader after normal completion", async () => {
    const source = of(1);
    const { port1, port2 } = new MessageChannel();
    const sent = sendStream(source, port1);
    expect(await collect(receiveStream(port2))).toEqual([1]);
    await sent;
    expect(source.locked).toBe(false);
  });
  it("carry values, completion, and structured-cloneable objects across a port", async () => {
    const { port1, port2 } = new MessageChannel();
    void sendStream(of<unknown>(1, { a: [2] }, new Date(0)), port1);
    expect(await collect(receiveStream(port2))).toEqual([1, { a: [2] }, new Date(0)]);
  });

  it("send only as many values as the receiver reads", async () => {
    let produced = 0;
    const source = new ReadableStream<number>(
      {
        pull(c) {
          c.enqueue(produced++);
        },
      },
      { highWaterMark: 0 },
    );
    const { port1, port2 } = new MessageChannel();
    void sendStream(source, port1);
    const reader = receiveStream<number>(port2).getReader();
    expect((await reader.read()).value).toBe(0);
    expect((await reader.read()).value).toBe(1);
    await settle();
    expect(produced).toBeLessThanOrEqual(3);
    await reader.cancel();
  });

  it("cancelling the receiver cancels the sender's stream", async () => {
    const source = probe<number>();
    const { port1, port2 } = new MessageChannel();
    const sent = sendStream(source.stream, port1);
    const reader = receiveStream<number>(port2).getReader();
    void reader.read();
    await settle();
    source.next(1);
    await settle();
    await reader.cancel("stop");
    await sent;
    expect(source.cancelled).toBe(true);
  });

  it("forwards errors", async () => {
    const failing = createStream<number>((s) => {
      s.next(1);
      s.error(new TypeError("bad input"));
    });
    const { port1, port2 } = new MessageChannel();
    void sendStream(failing, port1);
    const reader = receiveStream<number>(port2).getReader();
    expect((await reader.read()).value).toBe(1);
    await expect(reader.read()).rejects.toThrow("bad input");
  });

  it("errors when a value cannot be cloned, and cancels the source", async () => {
    const source = probe<() => void>();
    const { port1, port2 } = new MessageChannel();
    void sendStream(source.stream, port1);
    const result = collect(receiveStream(port2));
    await settle();
    source.next(() => undefined);
    await expect(result).rejects.toBeDefined();
    await waitTicks();
    expect(source.cancelled).toBe(true);
  });

  it("transfers ArrayBuffers instead of copying when asked", async () => {
    const buffer = new Uint8Array([1, 2, 3]).buffer;
    const { port1, port2 } = new MessageChannel();
    void sendStream(of(buffer), port1, (b) => [b]);
    const [received] = await collect(receiveStream<ArrayBuffer>(port2));
    expect(buffer.byteLength).toBe(0);
    expect(new Uint8Array(received ?? new ArrayBuffer(0))).toEqual(new Uint8Array([1, 2, 3]));
  });
});

describe("inWorker() and serveOperators()", () => {
  it("propagates a factory exception and cancels the incoming source", async () => {
    const { port1, port2 } = new MessageChannel();
    const stop = serveOperators(
      {
        fail: () => {
          throw new Error("factory failed");
        },
      },
      port2,
    );
    const source = probe<number>();
    await expect(collect(source.stream.pipeThrough(inWorker(port1, "fail")))).rejects.toThrow(
      "factory failed",
    );
    await settle();
    expect(source.cancelled).toBe(true);
    stop();
    port1.close();
    port2.close();
  });
  const serve = (): MessagePort => {
    const { port1, port2 } = new MessageChannel();
    serveOperators(
      {
        double: () => map((n: number) => n * 2),
        evens: { create: () => filter((n: number) => n % 2 === 0) },
      },
      port2,
    );
    return port1;
  };

  it("runs a named operator on the other side", async () => {
    expect(
      await collect(of(1, 2, 3).pipeThrough(inWorker<number, number>(serve(), "double"))),
    ).toEqual([2, 4, 6]);
  });

  it("serves several independent requests", async () => {
    const worker = serve();
    const [a, b] = await Promise.all([
      collect(of(1, 2).pipeThrough(inWorker<number, number>(worker, "double"))),
      collect(of(1, 2, 3, 4).pipeThrough(inWorker<number, number>(worker, "evens"))),
    ]);
    expect([a, b]).toEqual([
      [2, 4],
      [2, 4],
    ]);
  });

  it("cancellation downstream reaches the source on this side", async () => {
    const source = probe<number>();
    const result = collect(
      source.stream.pipeThrough(inWorker<number, number>(serve(), "double")).pipeThrough(take(1)),
    );
    await settle();
    source.next(5);
    expect(await result).toEqual([10]);
    await settle();
    await settle();
    expect(source.cancelled).toBe(true);
  });

  it("errors for an unknown operator name", async () => {
    await expect(collect(of(1).pipeThrough(inWorker(serve(), "missing")))).rejects.toThrow(
      /no operator named "missing"/,
    );
  });
});
