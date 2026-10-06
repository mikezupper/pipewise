import { defineConfig } from "vite";

// Library build: one ESM file per source module so CDN users can import a
// single operator and bundlers can tree-shake. Types come from tsc
// (tsconfig.build.json), not from Vite.
export default defineConfig({
  build: {
    target: "es2022",
    minify: false,
    sourcemap: true,
    lib: {
      entry: { index: "src/index.ts", "testing/index": "src/testing/index.ts" },
      formats: ["es"],
    },
    rollupOptions: {
      output: {
        preserveModules: true,
        preserveModulesRoot: "src",
        entryFileNames: "[name].js",
      },
    },
  },
});
