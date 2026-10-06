# 0004: Operators for streaming responses

**Status:** Accepted.

## Context

A library of operators on Web Streams could aim to replace RxJS in general.
Benchmarks ([performance.md](../performance.md)) show why it should not: every
value costs 4–34 µs at every operator, because Web Streams are built to move
large chunks, not single small values. For synchronous throughput, pipewise is
50–120× slower than RxJS.

The alternatives each cover part of the space well:

- **RxJS** is mature, fast, and familiar for UI event logic, and its `from()`
  already accepts a `ReadableStream`.
- **The native DOM `Observable`**, shipping in Chromium, covers event streams
  in the browser without a library.
- **Async iterators** and `TransformStream` cover simple byte and text
  transforms.

None of them targets the place where Web Streams are already the native
format: `fetch` bodies, LLM token streams, `Response` bodies in edge runtimes,
and streams transferred to Workers. There, RxJS needs conversions at every
boundary and has no backpressure, and the platform offers pipes without
operators.

## Decision

pipewise is **operators for streaming responses**. Its audience is developers
building AI chat and agent frontends, streaming proxies, edge functions, and
network clients. Features are judged by whether they help that audience:

- Parsers for streaming formats: `sse`, `ndjson`, `lines`, `csv`.
- `fetch` and `Response` helpers: `fromFetch`, `responseText`, `toResponse`,
  `toSse`.
- Cancellation that reaches the network, bounded queues, and Workers.
- The RxJS-style operator set stays, because streaming code needs it
  (`switchMap`, `merge`, `retry`, `timeout`), and it stays RxJS-compatible in
  naming ([0001](0001-rxjs-naming.md)).

## Consequences

- The README leads with this use case and says plainly where pipewise does not
  fit: bulk in-memory processing, and UI-only code where RxJS is the better
  choice.
- Value rates in this audience (tokens, messages, events: hundreds to
  thousands per second) make the per-value cost invisible, so throughput work
  is not a priority, and batch mode for bulk text is not planned.
- The example application is a streaming LLM chat client with an edge proxy.
