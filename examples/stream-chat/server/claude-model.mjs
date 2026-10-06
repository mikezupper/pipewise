// Streams an answer from Claude through the Anthropic Messages API, using raw
// fetch on purpose: parsing the model's Server-Sent Events with pipewise is the
// point of this example. Production apps may prefer the @anthropic-ai/sdk package.
import { finalize, fromFetch, HttpError, map, responseText, retry, sse } from "pipewise";

const API = "https://api.anthropic.com/v1/messages";

/**
 * @param {{ apiKey: string, model?: string, retryDelay?: number, log?: (message: string) => void }} options
 * @returns {{ name: string, stream: (prompt: string) => ReadableStream<string> }}
 */
export function claudeModel({
  apiKey,
  model = "claude-opus-5-5",
  retryDelay = 1000,
  log = () => {},
}) {
  const connect = (prompt) =>
    fromFetch(API, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        // If a safety classifier declines, the API retries on its recommended fallback model.
        "anthropic-beta": "server-side-fallback-2026-07-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 16000,
        stream: true,
        fallbacks: "default",
        messages: [{ role: "user", content: prompt }],
      }),
    }).pipeThrough(
      map(async (response) => {
        // Rate limits and overload are worth retrying; other errors are not.
        if (response.status === 429 || response.status >= 500) {
          await response.body?.cancel();
          throw new HttpError(response);
        }
        return response;
      }),
    );

  return {
    name: `claude (${model})`,
    stream(prompt) {
      // Retry only the connection: once text has streamed, a retry would repeat it.
      return retry(() => connect(prompt), { count: 2, delay: retryDelay })
        .pipeThrough(responseText())
        .pipeThrough(sse())
        .pipeThrough(textDeltas())
        .pipeThrough(finalize(() => log("claude: upstream stream closed")));
    },
  };
}

/** Keeps the text of a Messages API event stream; turns error and refusal events into errors. */
function textDeltas() {
  return new TransformStream({
    transform({ data }, controller) {
      const event = JSON.parse(data);
      if (event.type === "error") {
        throw new Error(
          `Claude ${event.error?.type ?? "error"}: ${event.error?.message ?? "unknown"}`,
        );
      }
      if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
        controller.enqueue(event.delta.text);
      }
      if (event.type === "message_delta" && event.delta?.stop_reason === "refusal") {
        throw new Error("Claude declined to answer this prompt.");
      }
    },
  });
}
