// Run after pnpm build. Optionally pass a previous build's dist/index.js to
// compare medians in alternating order on the same machine.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import * as current from "../dist/index.js";

const versions = { current };
if (process.argv[2]) versions.baseline = await import(pathToFileURL(resolve(process.argv[2])).href);
const count = 100_000;
const tail = 50_000;
const cases = {
  "queued burst": {
    run: (pw) =>
      pw.collect(
        pw.createStream((s) => {
          for (let i = 0; i < count; i++) s.next(i);
          s.complete();
        }),
      ),
    first: 0,
    length: count,
  },
  "dropOldest burst": {
    run: (pw) =>
      pw.collect(
        pw.createStream(
          (s) => {
            for (let i = 0; i < count; i++) s.next(i);
            s.complete();
          },
          { buffer: tail, overflow: "dropOldest" },
        ),
      ),
    first: count - tail,
    length: tail,
  },
  "takeLast(50000)": {
    run: (pw) => pw.collect(pw.range(0, count).pipeThrough(pw.takeLast(tail))),
    first: count - tail,
    length: tail,
  },
  "skipLast(50000)": {
    run: (pw) => pw.collect(pw.range(0, count).pipeThrough(pw.skipLast(tail))),
    first: 0,
    length: count - tail,
  },
};

console.log(`${process.version}; ${count} values; median of 5 samples after warmup`);
for (const [name, scenario] of Object.entries(cases)) {
  const samples = Object.fromEntries(Object.keys(versions).map((label) => [label, []]));
  for (let round = -1; round < 5; round++) {
    const entries = Object.entries(versions);
    if (round % 2 === 0) entries.reverse();
    for (const [label, pw] of entries) {
      const start = performance.now();
      const values = await scenario.run(pw);
      const elapsed = performance.now() - start;
      assert.equal(values.length, scenario.length);
      for (let i = 0; i < values.length; i++) assert.equal(values[i], scenario.first + i);
      if (round >= 0) samples[label].push(elapsed);
    }
  }
  const medians = Object.fromEntries(
    Object.entries(samples).map(([label, times]) => [label, times.sort((a, b) => a - b)[2]]),
  );
  console.log(
    name.padEnd(20),
    Object.entries(medians)
      .map(([label, ms]) => `${label}: ${ms.toFixed(1)} ms`)
      .join("; "),
    medians.baseline ? `(${(medians.baseline / medians.current).toFixed(2)}× faster)` : "",
  );
}
