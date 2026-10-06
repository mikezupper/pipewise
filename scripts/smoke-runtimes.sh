#!/usr/bin/env bash
# Runs scripts/smoke-runtimes.mjs on the oldest supported Node, Deno, and Bun.
# Needs Docker (for Node 20 and Deno) and builds dist/ first.
set -euo pipefail
cd "$(dirname "$0")/.."
pnpm build >/dev/null
docker run --rm -v "$PWD":/app -w /app node:20-alpine node scripts/smoke-runtimes.mjs
docker run --rm -v "$PWD":/app -w /app denoland/deno:latest deno run --allow-read scripts/smoke-runtimes.mjs
if command -v bun >/dev/null; then
  bun scripts/smoke-runtimes.mjs
else
  docker run --rm -v "$PWD":/app -w /app oven/bun:latest bun scripts/smoke-runtimes.mjs
fi
