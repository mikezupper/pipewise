// Starts the example server on Deno, Bun, or Node:
//   node examples/stream-chat/server/main.mjs
//   deno run -A examples/stream-chat/server/main.mjs
//   bun examples/stream-chat/server/main.mjs
// Set ANTHROPIC_API_KEY to stream from Claude instead of the mock model.
import { createApp } from "./app.mjs";
import { mockModel } from "./mock-model.mjs";

const env = (name) => globalThis.Deno?.env.get(name) ?? globalThis.process?.env[name];
const port = Number(env("PORT") ?? 8787);
const log = (message) => console.log(`[stream-chat] ${message}`);

async function chooseModel() {
  if (env("ANTHROPIC_API_KEY")) {
    const { claudeModel } = await import("./claude-model.mjs");
    return claudeModel({ apiKey: env("ANTHROPIC_API_KEY"), model: env("CLAUDE_MODEL"), log });
  }
  return mockModel({ delay: Number(env("MOCK_DELAY") ?? 40), log });
}

const model = await chooseModel();
const app = createApp({ model, log });

if (globalThis.Deno) {
  globalThis.Deno.serve(
    { port, onListen: () => log(`Deno on http://localhost:${port} (${model.name})`) },
    app.fetch,
  );
} else if (globalThis.Bun) {
  globalThis.Bun.serve({ port, fetch: app.fetch, idleTimeout: 0 });
  log(`Bun on http://localhost:${port} (${model.name})`);
} else {
  const { serveNode } = await import("./node-adapter.mjs");
  await serveNode(app.fetch, port);
  log(`Node on http://localhost:${port} (${model.name})`);
}
