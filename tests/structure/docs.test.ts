/// <reference types="node" />
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT } from "./catalog.js";

function markdownFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if ([".git", ".beads", ".claude", ".runner", "node_modules", "dist"].includes(entry.name))
      return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return markdownFiles(path);
    return entry.name.endsWith(".md") ? [path] : [];
  });
}

describe("docs", () => {
  it("every relative link resolves", () => {
    const broken: string[] = [];
    for (const file of markdownFiles(ROOT)) {
      const text = readFileSync(file, "utf8").replace(/```[\s\S]*?```/g, "");
      for (const [, target = ""] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
        if (/^(https?:|mailto:|#)/.test(target)) continue;
        const path = join(dirname(file), target.split("#")[0] ?? "");
        if (!existsSync(path))
          broken.push(`${relative(ROOT, file)} links to ${target}, which does not exist.`);
      }
    }
    expect(broken, "Fix or remove the broken links.").toEqual([]);
  });

  it("AGENTS.md stays a short map", () => {
    const lines = readFileSync(join(ROOT, "AGENTS.md"), "utf8").split("\n").length;
    expect(
      lines,
      "AGENTS.md is a table of contents. Move detail into docs/ and link to it.",
    ).toBeLessThanOrEqual(100);
  });
});
