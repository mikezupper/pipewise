import type { Operator, TransferList, WorkerLike } from "../types.js";
import { operator } from "../internal/operator.js";
import { receiveStream } from "./receive-stream.js";
import { sendStream } from "./send-stream.js";

/**
 * Runs the operator registered as `name` with `serveOperators()` inside
 * `worker`, on another thread. Values cross with backpressure in both
 * directions; cancellation and errors cross too. Values must be
 * structured-cloneable; `transfer` moves input objects such as `ArrayBuffer`s
 * instead of copying them.
 *
 * @example
 * const worker = new Worker(new URL("./parse.worker.js", import.meta.url), { type: "module" });
 * response.body.pipeThrough(inWorker(worker, "parseLogs", (chunk) => [chunk.buffer]));
 */
export function inWorker<In, Out>(
  worker: WorkerLike,
  name: string,
  transfer?: TransferList<In>,
): Operator<In, Out> {
  const input = new MessageChannel();
  const output = new MessageChannel();
  worker.postMessage({ pw: "connect", name, input: input.port2, output: output.port2 }, [
    input.port2,
    output.port2,
  ]);
  return operator((source) => {
    void sendStream(source, input.port1, transfer);
    return receiveStream<Out>(output.port1);
  });
}
