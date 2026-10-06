// The server-side pipeline: model tokens become a Server-Sent Events response
// with live metrics merged in. Everything here is pipewise operators.
import {
  auditTime,
  catchError,
  endWith,
  map,
  merge,
  of,
  scan,
  share,
  timeout,
  toResponse,
  toSse,
} from "pipewise";

/**
 * @param {ReadableStream<string>} tokens  the model's text deltas
 * @returns {Response}  a text/event-stream response
 */
export function chatResponse(tokens) {
  const started = Date.now();
  // Two readers of one model stream, read in lockstep (no unbounded buffer).
  const branch = share(tokens.pipeThrough(timeout({ first: 15_000, each: 10_000 })));

  const text = branch().pipeThrough(map((token) => ({ event: "text", data: token })));
  const metrics = branch()
    .pipeThrough(scan((count) => count + 1, 0))
    .pipeThrough(auditTime(250))
    .pipeThrough(
      map((count) => {
        const seconds = (Date.now() - started) / 1000;
        return {
          event: "metrics",
          data: JSON.stringify({ tokens: count, perSecond: Math.round(count / seconds) }),
        };
      }),
    );

  const events = merge(text, metrics)
    .pipeThrough(endWith({ event: "done", data: "" }))
    .pipeThrough(
      catchError((error) =>
        of({ event: "error", data: error instanceof Error ? error.message : String(error) }),
      ),
    );

  return toResponse(events.pipeThrough(toSse()), {
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache" },
  });
}
