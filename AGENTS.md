# AGENTS.md

pipewise is operators for streaming responses: zero-dependency operators for
the Web Streams that `fetch`, LLM APIs, edge runtimes, and Workers produce
([why](docs/design-docs/0004-positioning.md)). Source is TypeScript; the
package ships ESM JavaScript plus `.d.ts`.

This file is a map. Follow the links for detail; the linked files are the
system of record.

## Before you start

1. Run `bd prime`, then `bd ready`. All work is tracked in beads. Never use
   TODO files, markdown checklists, or plans in chat.
   How: [.claude/skills/beads/SKILL.md](.claude/skills/beads/SKILL.md).
2. File a bead before writing code. Close it with the commit hash and the
   test that proves it.
3. `pnpm install`, then `pnpm check`. It must pass before every commit.

## CI runner

CI runs on a self-hosted runner that lives in `.runner/` (gitignored) and runs
only during development sessions. When the maintainer says "start the
service", run `pnpm runner` as a background task and leave it running. Stop
it when they ask or when the session ends. Never install it as a system
service or outside this directory. Details: [docs/deployment.md](docs/deployment.md).

## Where things are

| You need                                      | Read                                                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| How the code is organized, and the invariants | [ARCHITECTURE.md](ARCHITECTURE.md)                                                               |
| Principles that settle design arguments       | [docs/core-beliefs.md](docs/core-beliefs.md)                                                     |
| Naming, file anatomy, how to add an operator  | [docs/conventions.md](docs/conventions.md)                                                       |
| Why a past decision was made                  | [docs/design-docs/index.md](docs/design-docs/index.md)                                           |
| Every public export, one line each            | [docs/generated/operators.md](docs/generated/operators.md)                                       |
| Quality grade per layer, known gaps           | [docs/quality.md](docs/quality.md)                                                               |
| CI, the self-hosted runner, releases          | [docs/deployment.md](docs/deployment.md)                                                         |
| Throughput, cost per value, bundle size       | [docs/performance.md](docs/performance.md)                                                       |
| A complete app built on pipewise              | [examples/stream-chat](examples/stream-chat/README.md)                                           |
| Writing any prose (docs, JSDoc, README)       | [.claude/skills/sense-of-style-writing/SKILL.md](.claude/skills/sense-of-style-writing/SKILL.md) |

## Commands

| Command                             | Does                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| `pnpm check`                        | The full gate: format, lint, typecheck, all tests, build, package checks       |
| `pnpm test:node`                    | Fast unit tests in Node only                                                   |
| `pnpm test:browser`                 | Tests in Chromium, Firefox, and WebKit                                         |
| `pnpm gen`                          | Regenerates `src/*/index.ts`, `docs/generated/`, and the README function count |
| `pnpm fmt`                          | Formats everything with Prettier                                               |
| `pnpm test:runtimes`                | Smoke test on Node 20, Deno, and Bun (needs Docker)                            |
| `pnpm bench`                        | Benchmarks against RxJS and plain loops                                        |
| `pnpm example` / `pnpm example:e2e` | Run the stream-chat example / its end-to-end check                             |
| `pnpm size`                         | Bundle-size budget check (part of `pnpm check`)                                |
| `pnpm lint:actions`                 | Lints GitHub workflows (needs Docker)                                          |

## Rules enforced by tests

`tests/structure/` fails with a fix-it message when you break one of these:

- Imports flow down the layers: foundation → internal → sources → combiners
  → operators → sinks → workers.
- `src/` imports nothing outside `src/` and uses no runtime-specific globals.
- Every public function has a JSDoc summary and `@example`, and a test calls it.
- Source files stay under 150 lines.
- Generated files are current. Fix with `pnpm gen`.

`tests/contract.test.ts` checks that every multi-input operator propagates
errors and cancels all its inputs. Add new multi-input operators to it.

## When you are stuck

The fix is rarely "try harder". Ask what is missing: a helper in
`src/internal/`, a rule in `tests/structure/`, or a paragraph in `docs/`.
Then add it, so the next agent does not get stuck in the same place.

## Git

- Branch from `main`; commit per bead with `Refs: <bead-id>` in the message.
- Do not add co-author trailers or "generated with" lines.
- Do not push, tag, or publish unless the maintainer asks.
