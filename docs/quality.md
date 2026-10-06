# Quality

Grades describe how far each layer is from the invariants in
[ARCHITECTURE.md](../ARCHITECTURE.md). Update this file when a grade changes;
track the work to close a gap as a bead labelled `tech-debt`.

| Layer                                                                     | Grade | Evidence                                                                                            | Gaps                                                                |
| ------------------------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Foundation (`types`, `errors`)                                            | A     | Strict types, isolated declarations                                                                 | None known                                                          |
| `internal/`                                                               | A     | Contract cases; stalled callback/readiness cancellation; queue compaction and port fallback tests   | None known                                                          |
| `sources/`                                                                | A     | Teardown tested for every push source; overflow strategies tested                                   | Push sources are unbounded unless given `QueueOptions` (documented) |
| `combiners/`                                                              | A     | Errors from each active input; cancellation, reader release, and empty `forkJoin` tests             | None known                                                          |
| `operators/`                                                              | A     | Input contracts; streams-of-streams cleanup; queued projection, duration, and timer callback errors | None known                                                          |
| `sinks/`                                                                  | A     | Error, cancellation, and reader release tests                                                       | None known                                                          |
| Streaming I/O (`fromFetch`, `responseText`, `sse`, `toSse`, `toResponse`) | A     | WHATWG SSE chunk splits; UTF-8 and cancellation tests; SSE round trip; live local example           | Upstream model requests use stubbed `fetch`                         |
| Docs                                                                      | B     | Catalog generated from source; links checked                                                        | Examples in JSDoc are not executed                                  |

List open debt with `bd list --label tech-debt`.

## Coverage

`pnpm test:coverage` runs the Node and example suites with V8 coverage. It
includes every implementation under `src/`, including files that were never
loaded. Generated `index.ts` barrels and the type-only `types.ts` are excluded.
The HTML report is written to `coverage/index.html`.

The coverage gate runs inside `pnpm check`, alongside the behavior tests in
Node, Chromium, Firefox, and WebKit. Its minimums are 98% lines, 96% statements,
98% functions, and 92% branches. They are aggregate minimums; use the HTML report
to find missing paths in an individual file.

Current coverage from the Node and example runs:

| Metric     | Current | Minimum |
| ---------- | ------- | ------- |
| Lines      | 99.17%  | 98%     |
| Statements | 97.69%  | 96%     |
| Functions  | 99.11%  | 98%     |
| Branches   | 93.98%  | 92%     |

Regression tests cover reader release, delayed retry and repeat
cancellation, fetch abort listeners and unread bodies, conditional sources,
comparator argument order, queued projections, time-window options, and
callback errors. The contract suite tests errors from each active input,
including `distinct`'s flush stream. General source tests also cover callable
thenables, once-only events, and already aborted event signals.

Coverage does not prove every ordering or runtime path. Browser Workers run in
all three browsers; the Web Worker test is skipped in Node, where runtime smoke
tests exercise real `worker_threads`. The stream-chat end-to-end check also
tests a live local server on Node, Deno, and Bun. Upstream model requests use
stubbed `fetch` in unit tests.
