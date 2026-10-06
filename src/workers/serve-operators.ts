import type { Operator, PortLike, TransferList } from "../types.js";
import { messageOf, postSafely } from "../internal/port-protocol.js";
import { receiveStream } from "./receive-stream.js";
import { sendStream } from "./send-stream.js";

/** An operator a worker offers, optionally with a transfer list for its outputs. */
export type ServedOperator =
  | (() => Operator<never, unknown>)
  | { readonly create: () => Operator<never, unknown>; readonly transfer?: TransferList<never> };

/**
 * Inside a worker, serves the operators that `inWorker()` asks for by name.
 * Each request gets a fresh operator from its factory. `scope` defaults to the
 * worker's global scope; in Node pass `parentPort`. Returns a function that
 * stops serving new requests.
 *
 * @example
 * // parse.worker.js
 * serveOperators({ parseLogs: () => subchain((s) => s.pipeThrough(new TextDecoderStream()).pipeThrough(ndjson())) });
 */
export function serveOperators(
  operators: Readonly<Record<string, ServedOperator>>,
  scope: PortLike = globalThis as unknown as PortLike,
): () => void {
  const onMessage = (event: MessageEvent): void => {
    const message = messageOf(event);
    if (message?.pw !== "connect") return;
    const { name, input, output } = message;
    const served = Object.hasOwn(operators, name) ? operators[name] : undefined;
    const incoming = receiveStream<never>(input);
    try {
      if (!served) throw new Error(`pipewise: no operator named "${name}"`);
      const { create, transfer } =
        typeof served === "function" ? { create: served, transfer: undefined } : served;
      void sendStream(
        incoming.pipeThrough(create()),
        output,
        transfer as TransferList<unknown> | undefined,
      );
    } catch (reason) {
      void incoming.cancel();
      postSafely(output, { pw: "error", reason });
      output.close();
    }
  };
  scope.addEventListener("message", onMessage);
  scope.start?.();
  return () => {
    scope.removeEventListener("message", onMessage);
  };
}
