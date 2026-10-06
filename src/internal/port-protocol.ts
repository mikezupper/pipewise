import type { PortLike } from "../types.js";

/** Messages of the stream protocol. Each port carries one direction of one stream. */
export type Message =
  | { readonly pw: "pull" }
  | { readonly pw: "cancel"; readonly reason?: unknown }
  | { readonly pw: "next"; readonly value: unknown }
  | { readonly pw: "done" }
  | { readonly pw: "error"; readonly reason: unknown }
  | {
      readonly pw: "connect";
      readonly name: string;
      readonly input: MessagePort;
      readonly output: MessagePort;
    };

/** Reads a protocol message from an event, or `undefined` for anything else. */
export function messageOf(event: MessageEvent): Message | undefined {
  const data: unknown = event.data;
  return typeof data === "object" && data !== null && "pw" in data ? (data as Message) : undefined;
}

/** Posts a message that may fail to clone; falls back to a plain-text reason. */
export function postSafely(
  port: PortLike,
  message: Message,
  transfer: Transferable[] = [],
): boolean {
  try {
    port.postMessage(message, transfer);
    return true;
  } catch (error) {
    if (message.pw === "error" || message.pw === "cancel") {
      port.postMessage({ pw: message.pw, reason: String(message.reason) });
    }
    if (message.pw === "next") throw error;
    return false;
  }
}
