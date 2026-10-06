// Worker side of the runtime smoke test: serves one operator.
import { map, serveOperators } from "../dist/index.js";

const scope =
  globalThis.Deno || globalThis.Bun ? globalThis : (await import("node:worker_threads")).parentPort;
serveOperators({ double: () => map((n) => n * 2) }, scope);
