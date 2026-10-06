/// <reference types="node" />
/**
 * Runs every ```js block in README.md against the source, so the README
 * cannot drift from the code. A `console.log(x); // output` comment is checked
 * against what the code actually prints.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { format } from "node:util";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { probe } from "../../src/testing/index.js";
import { publicExports, ROOT } from "./catalog.js";

const blocks = [
  ...readFileSync(join(ROOT, "README.md"), "utf8").matchAll(/```js\n([\s\S]*?)```/g),
].map((m) => (m[1] ?? "").replace(/^ {2}/gm, ""));
const tmp = join(ROOT, "tests/.readme");
mkdirSync(tmp, { recursive: true });
afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function runBlock(index: number): Promise<string[]> {
  const code = (blocks[index] ?? "").replace(/from "pipewise"/g, `from "../../src/index.js"`);
  const file = join(tmp, `block-${String(index)}.mjs`);
  writeFileSync(file, code);
  const printed: string[] = [];
  vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    printed.push(format(...args));
  });
  await import(/* @vite-ignore */ file);
  return printed;
}

const squash = (s: string): string => s.replace(/\s+/g, "");

// Each block imports the source cold, which is slow while the browser suite
// runs in parallel.
describe("README", { timeout: 30_000 }, () => {
  it("has code samples", () => {
    expect(blocks.length).toBeGreaterThanOrEqual(3);
  });

  it("states the current number of public functions", () => {
    const count = publicExports().filter((e) => e.isFunction).length;
    const readme = readFileSync(join(ROOT, "README.md"), "utf8");
    expect(readme, "README.md is stale. Run `pnpm gen`.").toContain(
      `${String(count)} functions in all`,
    );
  });

  it.each(blocks.map((code, i) => [i, code] as const).filter(([, c]) => !c.includes("document.")))(
    "block %i runs and prints what its comments say",
    async (index, code) => {
      const expected = [...code.matchAll(/console\.log\(.*\);\s*\/\/\s*(.+)$/gm)].map(
        (m) => m[1] ?? "",
      );
      const printed = await runBlock(index);
      expect(printed.map(squash)).toEqual(expected.map(squash));
    },
  );

  it("the chat example streams an answer and cancels it for a new prompt", async () => {
    const index = blocks.findIndex((c) => c.includes("document."));
    expect(index).toBeGreaterThanOrEqual(0);
    vi.useFakeTimers();
    const form = Object.assign(new EventTarget(), { elements: { prompt: { value: "" } } });
    const output = { textContent: "" };
    const bodies: ReturnType<typeof probe<Uint8Array<ArrayBuffer>>>[] = [];
    const prompts: unknown[] = [];
    vi.stubGlobal("document", {
      querySelector: (selector: string) => (selector === "form" ? form : output),
    });
    vi.stubGlobal("fetch", (_url: string, init: { body: string }) => {
      prompts.push(JSON.parse(init.body));
      const body = probe<Uint8Array<ArrayBuffer>>();
      bodies.push(body);
      return Promise.resolve(new Response(body.stream));
    });
    await runBlock(index);
    const ask = async (prompt: string): Promise<void> => {
      form.elements.prompt.value = prompt;
      form.dispatchEvent(new Event("submit", { cancelable: true }));
      await vi.advanceTimersByTimeAsync(0);
    };
    const send = async (body: (typeof bodies)[number] | undefined, data: string): Promise<void> => {
      body?.next(new TextEncoder().encode(`data: ${data}\n\n`));
      await vi.advanceTimersByTimeAsync(60);
    };

    await ask("hi");
    await send(bodies[0], "Hel");
    await send(bodies[0], "lo");
    expect(output.textContent).toBe("Hello");
    await ask("bye");
    expect(bodies[0]?.cancelled).toBe(true);
    await send(bodies[1], "Bye");
    expect(output.textContent).toBe("Bye");
    expect(prompts).toEqual([{ prompt: "hi" }, { prompt: "bye" }]);
  });
});
