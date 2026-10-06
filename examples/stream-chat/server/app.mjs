// One standard fetch(request) handler. It runs unchanged on Node (through the
// adapter in main.mjs), Deno, Bun, and edge runtimes.
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chatResponse } from "./chat.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const STATIC = {
  "/client/": join(HERE, "../client/"),
  "/pipewise/": join(HERE, "../../../dist/"),
};
const TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".map": "application/json",
};

/**
 * @param {{ model: { name: string, stream: (prompt: string) => ReadableStream<string> }, log?: (message: string) => void }} options
 */
export function createApp({ model, log = () => {} }) {
  let requests = 0;
  return {
    async fetch(request) {
      const url = new URL(request.url);
      if (request.method === "POST" && url.pathname === "/chat") return chat(request);
      if (request.method === "GET" && url.pathname === "/")
        return serveFile(join(HERE, "../client/index.html"));
      for (const [prefix, dir] of Object.entries(STATIC)) {
        if (request.method === "GET" && url.pathname.startsWith(prefix)) {
          const path = normalize(join(dir, url.pathname.slice(prefix.length)));
          if (path.startsWith(dir) && !path.includes(`${sep}..${sep}`)) return serveFile(path);
        }
      }
      return new Response("Not found", { status: 404 });
    },
  };

  async function chat(request) {
    const body = await request.json().catch(() => undefined);
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    if (prompt === "" || prompt.length > 4000) {
      return Response.json(
        { error: "Send { prompt } as a non-empty string of at most 4000 characters." },
        { status: 400 },
      );
    }
    const id = ++requests;
    log(`#${id} ${model.name}: “${prompt.slice(0, 60)}”`);
    return chatResponse(model.stream(prompt));
  }
}

async function serveFile(path) {
  try {
    const type = TYPES[extname(path)] ?? "application/octet-stream";
    return new Response(await readFile(path), { headers: { "content-type": type } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
