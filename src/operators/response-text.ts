import { HttpError } from "../errors.js";
import { drain } from "../internal/drain.js";
import { operator } from "../internal/operator.js";
import { createStream } from "../sources/create-stream.js";
import type { Operator } from "../types.js";

/** Options for `responseText()`. */
export interface ResponseTextOptions {
  /** Stream the body of non-2xx responses too, instead of erroring with `HttpError`. Defaults to `false`. */
  readonly allowErrorStatus?: boolean;
}

/**
 * Streams each response's body as decoded text chunks. A response whose
 * status is not 2xx errors with `HttpError` unless `allowErrorStatus` is set.
 * Cancelling cancels the body, which closes the connection.
 *
 * @example
 * fromFetch("/stream").pipeThrough(responseText()).pipeThrough(lines());
 */
export function responseText(options: ResponseTextOptions = {}): Operator<Response, string> {
  const { allowErrorStatus = false } = options;
  return operator((source) =>
    createStream<string>(async (subscriber) => {
      await drain(
        source,
        async (response) => {
          if (!response.ok && !allowErrorStatus) {
            await response.body?.cancel().catch(() => undefined);
            throw new HttpError(response);
          }
          if (!response.body) return;
          const text = response.body.pipeThrough(new TextDecoderStream());
          await drain(
            text,
            (chunk) => {
              subscriber.next(chunk);
            },
            subscriber.signal,
            () => subscriber.ready(),
          );
        },
        subscriber.signal,
      );
      subscriber.complete();
    }),
  );
}
