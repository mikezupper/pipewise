import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

// Every test runs twice: once in Node and once in real browsers.
// A behaviour that differs between runtimes is a bug.
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/index.ts", "src/types.ts"],
      reporter: ["text", "html", "json-summary"],
      thresholds: { lines: 98, statements: 96, functions: 98, branches: 92 },
    },
    projects: [
      {
        test: {
          name: "node",
          include: ["tests/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        // The example imports "pipewise" by name; test it against the source.
        resolve: {
          alias: [
            {
              find: /^pipewise$/,
              replacement: new URL("./src/index.ts", import.meta.url).pathname,
            },
          ],
        },
        test: {
          name: "examples",
          include: ["examples/**/*.test.mjs"],
          environment: "node",
        },
      },
      {
        test: {
          name: "browser",
          include: ["tests/**/*.test.ts"],
          exclude: ["tests/structure/**"],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }, { browser: "firefox" }, { browser: "webkit" }],
          },
        },
      },
    ],
  },
});
