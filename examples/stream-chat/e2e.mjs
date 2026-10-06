// End-to-end check for the example. Run with `pnpm example:e2e` (builds first).
// 1. Starts the server on Node with a fast mock model and drives the page in
//    Chromium: stream an answer, cancel it with a new prompt, stop one, finish one.
// 2. Starts the same server on Bun and Deno and streams one answer from each.
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../..", import.meta.url));
const main = "examples/stream-chat/server/main.mjs";
const freePort = () =>
  new Promise((resolve) => {
    const server = createServer().listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
const waitFor = async (check, label, ms = 10_000) => {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`Timed out waiting for: ${label}`);
};

function start(command, args, port) {
  const logs = [];
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, PORT: String(port), MOCK_DELAY: "30" },
  });
  child.stdout.on("data", (d) => logs.push(...String(d).trim().split("\n")));
  child.stderr.on("data", (d) => logs.push(...String(d).trim().split("\n")));
  return {
    child,
    logs,
    ready: waitFor(() => logs.some((l) => l.includes(`:${port}`)), `${command} server on ${port}`),
  };
}

async function streamOnce(port) {
  const response = await fetch(`http://localhost:${port}/chat`, {
    method: "POST",
    body: JSON.stringify({ prompt: "runtime check" }),
  });
  const text = await response.text();
  if (!text.includes("event: done"))
    throw new Error(`no done event from port ${port}:\n${text.slice(0, 300)}`);
}

async function browserCheck() {
  const port = await freePort();
  const server = start("node", [main], port);
  await server.ready;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));
    page.on("console", (m) => m.type() === "error" && pageErrors.push(m.text()));
    await page.goto(`http://localhost:${port}/`);
    const wire = () => page.locator("#wire").innerText();
    const askFor = async (prompt) => {
      await page.fill("#prompt", prompt);
      await page.press("#prompt", "Enter");
    };

    await askFor("first");
    await waitFor(
      async () => (await page.locator("#answer").innerText()).includes("“first”"),
      "first answer streaming",
    );
    await askFor("second");
    await waitFor(async () => (await wire()).includes("#1 cancelled"), "new prompt cancels #1");
    await waitFor(
      async () => (await page.locator("#answer").innerText()).includes("“second”"),
      "second answer streaming",
    );
    await page.click("#stop");
    await waitFor(async () => (await wire()).includes("#2 cancelled"), "stop cancels #2");
    await askFor("third");
    await waitFor(async () => (await wire()).includes("#3 complete"), "#3 completes", 20_000);
    if (!/\d+ tokens/.test(await page.locator("#metrics").innerText()))
      throw new Error("metrics never rendered");
    await waitFor(
      () => server.logs.filter((l) => l.includes("mock model: stopped after")).length >= 2,
      "server saw both cancellations",
    );
    if (pageErrors.length > 0) throw new Error(`page errors:\n${pageErrors.join("\n")}`);
    console.log(
      "✓ browser: streams, cancels on new prompt, stops, completes; server stopped the model twice",
    );
  } finally {
    await browser.close();
    server.child.kill();
  }
}

async function runtimeCheck(name, command, args, port, cleanup = () => {}) {
  const server = start(command, args, port);
  try {
    await server.ready;
    await streamOnce(port);
    console.log(`✓ ${name}: server streams an answer`);
  } finally {
    server.child.kill();
    cleanup();
  }
}

await browserCheck();
await runtimeCheck("bun", "bun", [main], await freePort());
const denoPort = await freePort();
const name = `stream-chat-deno-${denoPort}`;
await runtimeCheck(
  "deno",
  "docker",
  [
    "run",
    "--rm",
    "--name",
    name,
    "--network",
    "host",
    "-e",
    `PORT=${denoPort}`,
    "-e",
    "MOCK_DELAY=30",
    "-v",
    `${root}:/app`,
    "-w",
    "/app",
    "denoland/deno:latest",
    "run",
    "-A",
    main,
  ],
  denoPort,
  () => execFileSync("docker", ["rm", "-f", name], { stdio: "ignore" }),
);
