import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "coverage", ".beads", ".claude", ".runner"] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: ["src/**/*.ts"],
    rules: {
      "no-console": "error",
      // Destructuring keys out of an options object to drop them is intended.
      "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true }],
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportDefaultDeclaration",
          message: "Use named exports. Every operator is re-exported by name from src/index.ts.",
        },
      ],
    },
  },
  {
    files: ["tests/**/*.ts"],
    rules: {
      // Terse arrow callbacks like `() => next(1)` keep step lists readable.
      "@typescript-eslint/no-confusing-void-expression": "off",
    },
  },
  {
    files: ["**/*.js", "**/*.mjs"],
    ...tseslint.configs.disableTypeChecked,
    // Scripts run in several runtimes (Node, Deno, Bun) and use their globals.
    rules: { ...tseslint.configs.disableTypeChecked.rules, "no-undef": "off" },
  },
);
