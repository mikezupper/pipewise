// Exercises the built package (dist/) in whatever runtime executes this file:
// values, combiners, cancellation, timers, events, errors. Used to verify the
// claim that pipewise runs on Node 20+, Deno, and Bun. Run after `pnpm build`.
import * as pw from "../dist/index.js";

const assertEqual = (actual, expected, label) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
};

assertEqual(
  await pw.collect(
    pw
      .of(1, 2, 3, 4)
      .pipeThrough(pw.filter((n) => n % 2 === 0))
      .pipeThrough(pw.map((n) => n * 10)),
  ),
  [20, 40],
  "map/filter",
);
assertEqual(
  await pw.collect(pw.zip(pw.of(1, 2), pw.of("a", "b"))),
  [
    [1, "a"],
    [2, "b"],
  ],
  "zip",
);
assertEqual(
  await pw.collect(pw.of(1, 2).pipeThrough(pw.concatMap((v) => pw.of(v, v * 10)))),
  [1, 10, 2, 20],
  "concatMap",
);
assertEqual(await pw.collect(pw.interval(1).pipeThrough(pw.take(3))), [0, 1, 2], "interval/take");

const target = new EventTarget();
const clicks = pw.collect(
  pw
    .fromEvent(target, "ping")
    .pipeThrough(pw.take(2))
    .pipeThrough(pw.map((e) => e.type)),
);
target.dispatchEvent(new Event("ping"));
target.dispatchEvent(new Event("ping"));
assertEqual(await clicks, ["ping", "ping"], "fromEvent");

const branch = pw.share(pw.interval(1).pipeThrough(pw.take(2)));
assertEqual(
  await Promise.all([pw.collect(branch()), pw.collect(branch())]),
  [
    [0, 1],
    [0, 1],
  ],
  "share",
);

let attempts = 0;
const flaky = () =>
  pw.fromAsyncFunction(async () => {
    if (attempts++ < 2) throw new Error("flaky");
    return "ok";
  });
assertEqual(await pw.collect(pw.retry(flaky, { count: 3 })), ["ok"], "retry");

try {
  await pw.collect(pw.createStream(() => undefined).pipeThrough(pw.timeout(5)));
  throw new Error("timeout did not fire");
} catch (error) {
  if (!(error instanceof pw.TimeoutError)) throw error;
}

// A real worker thread: Node's worker_threads, or a Web Worker on Deno and Bun.
const workerUrl = new URL("./smoke-worker.mjs", import.meta.url);
const worker =
  globalThis.Deno || globalThis.Bun
    ? new Worker(workerUrl.href, { type: "module" })
    : new (await import("node:worker_threads")).Worker(workerUrl);
try {
  assertEqual(
    await pw
      .collect(pw.range(1, 100).pipeThrough(pw.inWorker(worker, "double")))
      .then((v) => [v.length, v[99]]),
    [100, 200],
    "inWorker",
  );
} finally {
  await worker.terminate();
}

const runtime = globalThis.Deno
  ? `Deno ${Deno.version.deno}`
  : globalThis.Bun
    ? `Bun ${Bun.version}`
    : `Node ${process.version}`;
console.log(`runtime smoke test passed on ${runtime}`);
