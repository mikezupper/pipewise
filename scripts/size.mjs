// Measures what pipewise costs an app: bundles representative imports from
// dist/ with minification and gzip, and fails if size-budget.json is exceeded.
// Run after `pnpm build`. Pass --update to rewrite the budget with 10% headroom.
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const root = resolve(import.meta.dirname, "..");
const budgetFile = join(root, "size-budget.json");

const scenarios = {
  everything: `import * as pw from "./dist/index.js"; globalThis.pw = pw;`,
  "fetch source": `import { fromFetch } from "./dist/index.js"; globalThis.x = fromFetch;`,
  "streaming chat": `import { fromEvent, fromFetch, map, responseText, scan, sse, subscribe, switchMap, throttleTime } from "./dist/index.js";
globalThis.x = [fromEvent, fromFetch, map, responseText, scan, sse, subscribe, switchMap, throttleTime];`,
  "edge SSE handler": `import { toResponse, toSse, map } from "./dist/index.js"; globalThis.x = [toResponse, toSse, map];`,
  // The flattening operators a framework runtime uses for concurrency lanes.
  lanes: `import { mergeMap, switchMap, exhaustMap, concatMap, createStream, retry } from "./dist/index.js";
globalThis.x = [mergeMap, switchMap, exhaustMap, concatMap, createStream, retry];`,
  "minimal pipeline": `import { of, map, filter, collect } from "./dist/index.js"; globalThis.x = [of, map, filter, collect];`,
  "typical UI": `import { fromEvent, debounceTime, distinctUntilChanged, switchMap, fromAsyncFunction, subscribe } from "./dist/index.js";
globalThis.x = [fromEvent, debounceTime, distinctUntilChanged, switchMap, fromAsyncFunction, subscribe];`,
  "log processing": `import { lines, ndjson, filter, bufferTime, inWorker, serveOperators } from "./dist/index.js";
globalThis.x = [lines, ndjson, filter, bufferTime, inWorker, serveOperators];`,
  "testing kit": `import * as t from "./dist/testing/index.js"; globalThis.t = t;`,
};

const measure = async (contents) => {
  const result = await build({
    stdin: { contents, resolveDir: root, loader: "js" },
    bundle: true,
    minify: true,
    format: "esm",
    write: false,
    logLevel: "silent",
  });
  const code = result.outputFiles[0].contents;
  return { minified: code.length, gzip: gzipSync(code, { level: 9 }).length };
};

const sizes = {};
for (const [name, contents] of Object.entries(scenarios)) sizes[name] = await measure(contents);

const kb = (n) => `${(n / 1024).toFixed(2)} kB`;
const update = process.argv.includes("--update");
const budget = update ? {} : JSON.parse(readFileSync(budgetFile, "utf8"));
let failed = false;
console.log(
  "scenario".padEnd(18),
  "minified".padStart(10),
  "gzip".padStart(10),
  "budget".padStart(10),
);
for (const [name, { minified, gzip }] of Object.entries(sizes)) {
  if (update) budget[name] = Math.ceil((gzip * 1.1) / 64) * 64;
  const limit = budget[name];
  const over = limit === undefined || gzip > limit;
  failed ||= over;
  console.log(
    name.padEnd(18),
    kb(minified).padStart(10),
    kb(gzip).padStart(10),
    (limit ? kb(limit) : "none").padStart(10),
    over ? "OVER" : "",
  );
}
if (update) writeFileSync(budgetFile, JSON.stringify(budget, null, 2) + "\n");
else if (failed) {
  console.error(
    "\nBundle size budget exceeded. Shrink the code, or if the growth is intended, run `node scripts/size.mjs --update` and explain why in the commit.",
  );
  process.exit(1);
}
