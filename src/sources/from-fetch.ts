import type { Observable } from "../types.js";

/**
 * Calls `fetch(input, init)` and emits the `Response`, then completes, like
 * RxJS's `fromFetch`. Cancelling before the response arrives aborts the
 * request, as does aborting `init.signal` (or the input request's signal).
 * Read the body with `responseText()`. Cancelling that chain, or cancelling
 * before an emitted response is read, cancels the body and closes the connection.
 *
 * @example
 * fromFetch("/chat", { method: "POST", body: JSON.stringify({ prompt }) }).pipeThrough(responseText());
 */
export function fromFetch(input: RequestInfo | URL, init: RequestInit = {}): Observable<Response> {
  const control = new AbortController();
  const external =
    init.signal === undefined && input instanceof Request ? input.signal : init.signal;
  let response: Response | undefined;
  let cancelled = false;
  const onAbort = (): void => {
    control.abort(external?.reason);
  };
  const cleanup = (): void => {
    external?.removeEventListener("abort", onAbort);
  };
  return new ReadableStream<Response>(
    {
      async start(controller) {
        if (external?.aborted) onAbort();
        else external?.addEventListener("abort", onAbort, { once: true });
        try {
          response = await fetch(input, { ...init, signal: control.signal });
          if (cancelled) {
            await response.body?.cancel().catch(() => undefined);
            return;
          }
          controller.enqueue(response);
          controller.close();
        } finally {
          cleanup();
        }
      },
      async cancel(reason) {
        cancelled = true;
        if (!response) control.abort(reason);
        cleanup();
        await response?.body?.cancel(reason).catch(() => undefined);
      },
    },
    { highWaterMark: 0 },
  );
}
