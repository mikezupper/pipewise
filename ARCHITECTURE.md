# Architecture

## Bird's-eye view

pipewise is operators for streaming responses: `fetch` bodies, LLM token
streams, edge-function `Response`s, and streams passed to Workers
([0004](docs/design-docs/0004-positioning.md)). A pipewise stream is a plain
`ReadableStream`. An operator is anything with a
`writable` and a `readable`, so it slots into the platform's own
`stream.pipeThrough(operator)`. The library adds no wrapper type, no
scheduler, and no runtime dependencies. Everything rests on four facts about
Web Streams:

1. A `ReadableStream` is pulled: the producer learns when the consumer wants
   the next value. That is backpressure, and it comes free.
2. `cancel()` travels upstream through `pipeThrough()`.
3. An error travels downstream through `pipeThrough()`.
4. A stream can be read only once.

Operators that take one input and keep no timers are `TransformStream`s, and
get facts 1 to 3 from the platform. Operators that read several streams
(`merge`, `switchMap`, `takeUntil`, …) cannot use a `TransformStream`, so they
rebuild facts 1 to 3 by hand. They all do it the same way, through two
primitives in the core.

## The core

**`createStream(producer)`** (`src/sources/create-stream.ts`) is the
push-to-pull bridge, equivalent to `new Observable()` in RxJS. The producer
gets a `Subscriber` with `next`, `error`, `complete`, `ready()`, and `signal`.
`ready()` resolves when a reader is waiting. `signal` aborts when the stream
ends for any reason, and the producer's teardown runs exactly once at that
moment.

**`drain(stream, onValue, signal, ready)`** (`src/internal/drain.ts`) reads a
stream to its end. It cancels the stream when `signal` aborts, waits on
`ready` before each read, and rejects if the stream errors.

A multi-input operator is `createStream` around one `drain` per input, all
sharing the subscriber's `signal`. Ending the output for any reason aborts
the signal, and every `drain` cancels its input. Any `drain` rejecting errors
the output. This is the whole mechanism behind the contract in
`tests/contract.test.ts`.

**`operator(build)`** (`src/internal/operator.ts`) adapts a function from
stream to stream into a `{ writable, readable }` pair for `pipeThrough()`.

## Code map

```
src/
  types.ts, errors.ts   foundation: Observable, Operator, Subscriber; EmptyError, …
  internal/             drain, operator, small helpers. Not exported.
  sources/              functions that create streams: createStream, fromFetch, share, retry, …
  combiners/            many streams into one: merge, zip, race, …
  operators/            one stream into another, used with pipeThrough,
                        including streaming formats: sse, toSse, ndjson, lines, csv
  sinks/                consume a stream: subscribe, collect, toResponse, …
  workers/              run a stage on another thread: inWorker, serveOperators
  index.ts              the public API: re-exports every folder
tests/
  <folder>/             behaviour tests, run in Node and three browsers
  contract.test.ts      error and cancellation guarantees for multi-input operators
  structure/            architecture rules, and the catalog generator they share
scripts/                gen.ts (derived files), smoke-pack.mjs (package import test)
```

Each folder may import only from itself and the folders listed above it. The
order is foundation → internal → sources → combiners → operators → sinks →
workers.

## Invariants

- Every stream is a native `ReadableStream`; nothing is wrapped or subclassed.
- Cancelling an output cancels every input the operator is reading, and inputs
  it was handed but never reached, including inner streams still waiting in
  a buffer.
- An error from any input reaches the output. Nothing is swallowed. A value
  emitted before an error is still delivered.
- `src/` runs unchanged on any runtime with Web Streams: Node 20+, Deno, Bun,
  and current browsers.
- Readable sides use `highWaterMark: 0`, so pull sources produce nothing before
  someone asks. Push sources (`fromEvent`, `interval`, `external`) cannot be
  paused, and timing operators (`debounceTime`, `throttleTime`, `delay`,
  `sample`, `buffer`) read continuously; in both cases unread values queue.
  `QueueOptions` on push sources, and the `bounded()` operator, cap that queue.

## Cross-cutting concerns

**Errors.** Domain errors are classes in `src/errors.ts`, so callers can test
with `instanceof`. An error thrown after its stream has ended, such as from a
teardown, is rethrown on a microtask rather than dropped.

**Time.** Timer operators use `setTimeout` and clear it on teardown. Their
tests use Vitest fake timers, so they run in microseconds and never flake.

**Threads.** `sendStream` and `receiveStream` carry one stream over a
`MessagePort` with a credit protocol: each read on the receiving side grants
the sender one value, so backpressure, cancellation, and errors cross the
thread boundary. `inWorker` and `serveOperators` build on them. The protocol
uses only `postMessage` and `addEventListener`, so it runs on browser Workers,
Node's `worker_threads`, Deno, and Bun.

**Types.** The build uses `isolatedDeclarations`, so every export carries an
explicit return type. That keeps the emitted `.d.ts` files exactly as written.
