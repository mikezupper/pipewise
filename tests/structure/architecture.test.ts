/// <reference types="node" />
/**
 * Mechanical checks for the rules in ARCHITECTURE.md and docs/conventions.md.
 * Each failure message says how to fix it.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  allSourceFiles,
  importsOf,
  LAYERS,
  layerOf,
  PUBLIC_FOLDERS,
  publicExports,
  read,
  renderCatalog,
  renderIndex,
  ROOT,
} from "./catalog.js";

const MAX_LINES = 150;

function testFiles(dir = join(ROOT, "tests")): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "structure" ? [] : testFiles(path);
    return entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

describe("architecture", () => {
  it("imports only flow downward through the layers", () => {
    const violations: string[] = [];
    for (const file of allSourceFiles()) {
      if (file.endsWith("index.ts")) continue;
      for (const target of importsOf(file)) {
        if (layerOf(target) > layerOf(file)) {
          violations.push(
            `${file} imports ${target}. Layer order is ${LAYERS.join(" → ")}; a file may import ` +
              `only from its own layer or a lower one. Move the shared code down a layer ` +
              `(usually into src/internal/) or implement it locally.`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("src has no runtime dependencies", () => {
    const violations = allSourceFiles().flatMap((file) =>
      importsOf(file)
        .filter((target) => !target.endsWith(".ts"))
        .map(
          (target) =>
            `${file} imports "${target}". pipewise ships with zero dependencies and runs on any ` +
            `runtime with Web Streams. Use relative imports and platform APIs only.`,
        ),
    );
    expect(violations).toEqual([]);
  });

  it("src uses no runtime-specific globals", () => {
    const banned = /\b(process|Buffer|require|document|navigator|Deno|Bun)\b\s*[.(]/;
    const violations = allSourceFiles()
      .filter((file) => banned.test(read(file).replace(/\/\*\*[\s\S]*?\*\/|\/\/.*$/gm, "")))
      .map(
        (file) =>
          `${file} uses a runtime-specific global. Code in src/ must run unchanged in Node, ` +
          `Deno, Bun, and browsers. Accept the dependency as a parameter instead.`,
      );
    expect(violations).toEqual([]);
  });

  it(`source files stay under ${String(MAX_LINES)} lines`, () => {
    const violations = allSourceFiles()
      .map((file) => [file, read(file).split("\n").length] as const)
      .filter(([, lines]) => lines > MAX_LINES)
      .map(
        ([file, lines]) =>
          `${file} has ${String(lines)} lines (limit ${String(MAX_LINES)}). Split helpers into ` +
          `src/internal/ or split the operator.`,
      );
    expect(violations).toEqual([]);
  });
});

describe("public API contract", () => {
  const exports = publicExports();

  it("every public folder index re-exports exactly its files", () => {
    for (const folder of PUBLIC_FOLDERS) {
      expect(read(`${folder}/index.ts`), `src/${folder}/index.ts is stale. Run \`pnpm gen\`.`).toBe(
        renderIndex(folder),
      );
    }
  });

  it("every public function has JSDoc with a summary and an @example", () => {
    const violations = exports
      .filter((e) => e.isFunction && (!e.summary || !e.hasExample))
      .map(
        (e) =>
          `${e.name} in src/${e.file} needs a JSDoc block that starts with a one-sentence ` +
          `summary and includes an @example. The summary appears in docs/generated/operators.md.`,
      );
    expect(violations).toEqual([]);
  });

  it("every public function is exercised by a test", () => {
    const tests = testFiles()
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");
    const violations = exports
      .filter((e) => e.isFunction && !new RegExp(`\\b${e.name}\\(`).test(tests))
      .map(
        (e) =>
          `${e.name} (src/${e.file}) is never called in tests/. Add a test under ` +
          `tests/${e.folder}/ covering values, completion, errors, and cancellation.`,
      );
    expect(violations).toEqual([]);
  });

  it("docs/generated/operators.md matches the source", () => {
    const current = readFileSync(join(ROOT, "docs/generated/operators.md"), "utf8");
    expect(current, "docs/generated/operators.md is stale. Run `pnpm gen`.").toBe(renderCatalog());
  });
});
