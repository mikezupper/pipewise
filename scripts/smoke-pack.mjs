// Packs the library, installs the tarball in a throwaway project, and runs a
// pipeline from plain JavaScript. Proves the published package imports
// cleanly and needs no TypeScript. Run after `pnpm build`.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const work = mkdtempSync(join(tmpdir(), "pipewise-smoke-"));
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: "pipe", encoding: "utf8" });

try {
  const tarball = run("pnpm", ["pack", "--pack-destination", work], root).trim().split("\n").pop();
  writeFileSync(
    join(work, "package.json"),
    JSON.stringify({ name: "smoke", type: "module", private: true }),
  );
  run("npm", ["install", "--no-audit", "--no-fund", "--silent", tarball], work);
  writeFileSync(
    join(work, "smoke.mjs"),
    `import { of, map, filter, collect } from "pipewise";
import { parseMarbles, probe } from "pipewise/testing";
if (parseMarbles("-a|").length !== 2 || typeof probe !== "function") throw new Error("pipewise/testing did not load");
const out = await collect(of(1, 2, 3, 4).pipeThrough(filter((n) => n % 2 === 0)).pipeThrough(map((n) => n * 10)));
if (JSON.stringify(out) !== "[20,40]") throw new Error("unexpected output: " + JSON.stringify(out));
console.log("pack smoke test passed:", out);
`,
  );
  process.stdout.write(run("node", ["smoke.mjs"], work));
} finally {
  rmSync(work, { recursive: true, force: true });
}
