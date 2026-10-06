// Node has no built-in server for fetch(request) handlers, so this adapts
// node:http. The important part: when the client disconnects, the response
// body is cancelled, and cancellation flows back through the pipeline.
import { createServer } from "node:http";
import { Readable } from "node:stream";

/**
 * @param {(request: Request) => Promise<Response>} handler
 * @param {number} port
 * @returns {Promise<import("node:http").Server>}
 */
export function serveNode(handler, port) {
  const server = createServer(async (req, res) => {
    const disconnected = new AbortController();
    res.on("close", () => disconnected.abort());
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (typeof value === "string") headers.set(name, value);
      else if (Array.isArray(value)) for (const item of value) headers.append(name, item);
    }
    const hasBody = req.method !== "GET" && req.method !== "HEAD";
    const request = new Request(new URL(req.url ?? "/", `http://${req.headers.host}`), {
      method: req.method,
      headers,
      body: hasBody ? Readable.toWeb(req) : undefined,
      duplex: "half",
      signal: disconnected.signal,
    });
    const response = await handler(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (!response.body) return void res.end();
    const reader = response.body.getReader();
    disconnected.signal.addEventListener(
      "abort",
      () => void reader.cancel("client disconnected").catch(() => {}),
    );
    try {
      for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read())
        res.write(chunk.value);
      res.end();
    } catch {
      res.destroy();
    }
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}
