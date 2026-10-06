import type { Observable } from "../types.js";

/**
 * Builds a `Response` whose body is the stream, for edge functions and
 * servers (Cloudflare Workers, Deno, Bun, Node route handlers). String chunks
 * are UTF-8 encoded; byte chunks pass through. When the client disconnects,
 * the runtime cancels the body, which cancels the stream.
 *
 * @example
 * export default {
 *   fetch: () => toResponse(answer.pipeThrough(toSse()), { headers: { "content-type": "text/event-stream" } }),
 * };
 */
export function toResponse(stream: Observable<string | Uint8Array>, init?: ResponseInit): Response {
  const encoder = new TextEncoder();
  const body = stream.pipeThrough(
    new TransformStream<string | Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
      },
    }),
  );
  return new Response(body as ReadableStream<Uint8Array<ArrayBuffer>>, init);
}
