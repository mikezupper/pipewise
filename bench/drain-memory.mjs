// Run after pnpm build with node --expose-gc. Optionally pass a previous
// build's dist/internal/drain.js. Measures retained heap while a stream stays open.
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { drain } from "../dist/internal/drain.js";

if (!globalThis.gc) throw new Error("Run with node --expose-gc");
const versions = { current: drain };
if (process.argv[2])
  versions.baseline = (await import(pathToFileURL(resolve(process.argv[2])).href)).drain;
const count = 50_000;

for (const [label, consume] of Object.entries(versions)) {
  globalThis.gc();
  const before = process.memoryUsage().heapUsed;
  let produced = 0;
  let consumed = 0;
  let ready;
  const checkpoint = new Promise((resolve) => {
    ready = resolve;
  });
  const source = new ReadableStream(
    {
      pull(controller) {
        if (produced++ < count) controller.enqueue(0);
      },
    },
    { highWaterMark: 0 },
  );
  const control = new AbortController();
  const done = consume(
    source,
    async () => {
      if (++consumed === count) ready();
    },
    control.signal,
  );
  await checkpoint;
  for (let i = 0; i < 100; i++) await Promise.resolve();
  globalThis.gc();
  console.log(
    `${label}: ${((process.memoryUsage().heapUsed - before) / 1024 / 1024).toFixed(2)} MiB retained after ${consumed} async callbacks`,
  );
  control.abort();
  await done;
}
