import { expect } from "vitest";
import { collect, fromIterable, type Operator } from "../src/index.js";

/** Lets queued promise callbacks run. Works with fake timers. */
export async function waitTicks(n = 20): Promise<void> {
  for (let i = 0; i < n; i++) await Promise.resolve();
}

export { probe, type Probe } from "../src/testing/index.js";

/** Every way to cut `text` into two or three chunks, plus one char per chunk. */
function chunkings(text: string): string[][] {
  const out: string[][] = [[text], Array.from(text)];
  for (let i = 1; i < text.length; i++) {
    out.push([text.slice(0, i), text.slice(i)]);
    for (let j = i + 1; j < text.length; j++)
      out.push([text.slice(0, i), text.slice(i, j), text.slice(j)]);
  }
  return out;
}

/** Asserts that `make()` produces `expected` however the input is chunked. */
export async function expectChunkSafe<T>(
  text: string,
  make: () => Operator<string, T>,
  expected: T[],
): Promise<void> {
  for (const chunks of chunkings(text)) {
    const result = await collect(fromIterable(chunks).pipeThrough(make()));
    expect(result, `chunks ${JSON.stringify(chunks)}`).toEqual(expected);
  }
}
