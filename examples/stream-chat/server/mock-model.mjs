// A stand-in for an LLM: streams a canned answer one word at a time, with a
// delay per token. Used by default and by the tests, so no API key is needed.
import { createStream } from "pipewise";

const ANSWER =
  "Streams are the web's way of saying: here is the first part, more is coming. " +
  "This answer arrives one token at a time, each one flowing through pipewise operators " +
  "on the server and again in your browser. Ask something else before it finishes, " +
  "and the old answer is cancelled all the way back to the model.";

/**
 * @param {{ delay?: number, log?: (message: string) => void }} [options]
 * @returns {{ name: string, stream: (prompt: string) => ReadableStream<string> }}
 */
export function mockModel({ delay = 40, log = () => {} } = {}) {
  return {
    name: "mock",
    stream(prompt) {
      return createStream(async (subscriber) => {
        const words = `You asked: “${prompt}”. ${ANSWER}`.split(/(?<= )/);
        for (const [index, word] of words.entries()) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          if (subscriber.closed) {
            log(
              `mock model: stopped after ${index} of ${words.length} tokens, nobody is listening`,
            );
            return;
          }
          if (prompt.includes("/fail") && index === 12)
            throw new Error("the mock model failed on purpose");
          subscriber.next(word);
        }
        subscriber.complete();
      });
    },
  };
}
