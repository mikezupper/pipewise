# Conventions

## Naming

- Use the RxJS name and argument order when the behaviour matches RxJS.
- When streams force different behaviour, change the signature (`retry` takes
  a factory) or the name (`repeatValue`, not `repeat`). Say so in the JSDoc.
- One canonical name per function. No aliases.
- Files are kebab-case and named after their export: `switchMap` lives in
  `switch-map.ts`.

## Anatomy of an operator

Pick the simplest form that works:

1. **One input, no timers:** return a `TransformStream` with
   `{ highWaterMark: 1 }` writable and `{ highWaterMark: 0 }` readable.
   See `src/operators/scan.ts`.
2. **Several inputs or timers:** `operator((source) => createStream(async (s) =>
{ … }))`, reading every input with `drain(…, s.signal, …)`. Clear timers on
   `s.signal`'s `abort` event. See `src/operators/take-until.ts`.
3. **A composition of existing operators:** `operator((source) =>
source.pipeThrough(a).pipeThrough(b))`. See `src/operators/switch-map.ts`.

Every exported function needs a JSDoc block: one summary sentence, the
behaviour on completion, error, and cancellation where it is not obvious,
and an `@example`. The summary becomes its row in the API catalog.

## Adding an operator

1. `bd create "Add <name>" -t feature` and claim it.
2. Write `src/<folder>/<name>.ts` following the anatomy above.
3. Add tests in `tests/<folder>/` for values, completion, errors, and
   cancellation. If it reads more than one stream, add a case to
   `tests/contract.test.ts`.
4. Run `pnpm gen`, then `pnpm check`.
5. Commit with `Refs: <bead-id>`, then close the bead with the commit hash.

## Tests

- Tests run in Node and in Chromium, Firefox, and WebKit. A behaviour that
  differs between them is a bug.
- Drive sources by hand with `probe()` or `external()` from the test helpers.
  `probe()` records whether the operator cancelled it.
- Use fake timers for anything time-based. Never assert on wall-clock time.
- Structural tests run in Node only.

## Prose

Write docs, JSDoc, and commit messages with the
[Sense of Style skill](../.claude/skills/sense-of-style-writing/SKILL.md).
Docs are short and practical: state the behaviour, the exact names, and what
happens on failure.
