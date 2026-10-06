# Performance

pipewise inherits the cost model of Web Streams, which were designed to move
large chunks of bytes, not one small JavaScript value per chunk. Every value
passing through a `pipeThrough()` hop pays for promises, queues, and pipe
bookkeeping. Know that cost before choosing pipewise for a workload.

## Throughput

Measured with `pnpm bench` (tinybench, against `dist/`) on Node v24.15.0, an
Intel Core i5-10400, 2026-10-06 UTC: two rounds each of two builds, alternating.
Absolute rates on this machine vary by up to 10× between runs, so the table
compares pipewise with RxJS measured in the same run, and gives the range
across runs.

| Pipeline                               | RxJS 7.8 | pipewise                                                        |
| -------------------------------------- | -------- | --------------------------------------------------------------- |
| map → filter → reduce, 100,000 values  | 1×       | 116–124× slower                                                 |
| scan, 100,000 values                   | 1×       | 47–51× slower                                                   |
| mergeMap, 2,000 inner streams of 10    | 1×       | 59–72× slower                                                   |
| switchMap, 2,000 inner streams of 3    | 1×       | 63–74× slower                                                   |
| NDJSON, 10,000 records in 2,000 chunks | n/a      | 11–13× slower than `split` + `JSON.parse` (`lines()` alone: 3×) |

A plain loop is faster still, by a margin too unstable to quote: across
sessions it ran from 2× to 22× ahead of RxJS on the same pipeline, depending on
how the JIT optimized it.

The cost is per value per hop, and it comes from the runtime's streams, not
from pipewise's logic. One `TransformStream` hop per value costs roughly:

| Runtime             | Per value, per hop |
| ------------------- | ------------------ |
| Node 24             | 4–8 µs             |
| WebKit (headless)   | 6 µs               |
| Chromium (headless) | 8 µs               |
| Firefox (headless)  | 34 µs              |

These come from 100,000 values through three identity transforms.

## Start latency

When a value reaches a flattening operator, the inner stream it maps to does
not start synchronously: reading a Web Stream resolves a promise, so the
inner producer (a `createStream` callback, a `fetch`) runs a few microtasks
later. Measured with a reader already waiting, in Node and all three
browsers:

| Operator     | Microtasks before the inner stream starts |
| ------------ | ----------------------------------------- |
| `switchMap`  | 1                                         |
| `mergeMap`   | 2                                         |
| `concatMap`  | 2                                         |
| `exhaustMap` | 2                                         |

`tests/operators/start-latency.test.ts` fails if any of these grows. The
delay is invisible for real I/O. In tests, `await flushMicrotasks()` from
`pipewise/testing` instead of waiting for a timer.

## Queues and retained memory

Two costs beyond the platform's own are easy to add by accident: removing
the first element of a large array for every read, which moves every queued
element, and racing each callback against a promise that stays pending for
the stream's lifetime, which retains one promise reaction per value.

`createStream`, `skipLast`, `takeLast`, `sequenceEqual`, and `expand` use a
FIFO with amortized constant-time removal. Consumed slots are cleared, and the
array is compacted as it drains. `shareReplay` removes old cache entries as
values arrive. `drain` observes input errors once per reader; `mergeMap` and
`expand` wait for a free slot with one waiter instead of racing every active
task. `switchMap` and `exhaustMap` add no extra stream stage.

The table compares these operators with the same operators built on
`Array.shift`: medians of five samples after warmup, alternating builds, on
the Node and CPU above. Each case uses 100,000 values; bounded and rolling
buffers hold 50,000. The benchmark checks every output value.

| Case                    | `Array.shift` | pipewise | Speedup         |
| ----------------------- | ------------- | -------- | --------------- |
| Queued burst            | 924.5 ms      | 60.7 ms  | 15.2×           |
| Burst with `dropOldest` | 635.5 ms      | 27.4 ms  | 23.2×           |
| `takeLast(50000)`       | 829.6 ms      | 358.4 ms | 1.5–2.3×, noisy |
| `skipLast(50000)`       | 705.9 ms      | 214.2 ms | 3.3×            |

Run `pnpm bench:queues` to measure the current build. To compare builds, run
`node bench/queues.mjs /path/to/previous/dist/index.js` after building both.

After 50,000 async callbacks on an input kept open, `drain` retains 0.3–0.5 MiB
of extra heap after garbage collection; a race-per-callback design retains
about 15 MiB. Measure with `node --expose-gc bench/drain-memory.mjs`, passing
another build's `dist/internal/drain.js` to compare.
These gains apply to backlogs and long-lived streams; scalar throughput still
pays the platform's per-value cost shown above.

## What this means

This cost is why pipewise is positioned as operators for streaming responses
([0004](design-docs/0004-positioning.md)).

- **Streaming responses are a good fit.** Model tokens, Server-Sent Events,
  network messages, and UI events arrive at hundreds or thousands per second. At a few
  microseconds per hop, the overhead is invisible next to the work each event
  triggers.
- **Bulk in-memory processing is not, unless batched.** A million values
  through five operators costs seconds. Move arrays instead of single values:
  a stream of 1,000-item arrays pays the per-value cost once per thousand.
  `bufferCount()` and `bufferTime()` create batches; `lines()` and friends
  emit one value per line; a batch mode is not planned, because streaming
  responses do not need one.
- **Synchronous callbacks are cheaper.** `map` and `tap` only wait when the
  callback returns a promise, so keep callbacks synchronous when you can.

## Bundle size

`pnpm size` (part of `pnpm check`) bundles representative imports with
esbuild, minified and gzipped, and fails if `size-budget.json` is exceeded.

| Import                                                                                          | Gzipped |
| ----------------------------------------------------------------------------------------------- | ------- |
| Everything                                                                                      | 11.0 kB |
| `fromFetch` alone                                                                               | 0.34 kB |
| Streaming chat client (`fromFetch`, `responseText`, `sse`, `switchMap`, …)                      | 2.7 kB  |
| Edge SSE handler (`toResponse`, `toSse`, `map`)                                                 | 0.53 kB |
| Concurrency lanes (`mergeMap`, `switchMap`, `exhaustMap`, `concatMap`, `createStream`, `retry`) | 2.1 kB  |
| `of`, `map`, `filter`, `collect`                                                                | 0.40 kB |
| `pipewise/testing`                                                                              | 2.1 kB  |

`fromFetch` now uses a native `ReadableStream` directly, so importing it alone
costs 344 gzipped bytes, down from 883 (61%). Shared native-transform construction
reduces duplicated minified code. The complete gzip bundle grew from 10.6 to
11.0 kB as error and cancellation cleanup paths were added; every existing budget
still passes without an increase. A new 384-byte budget guards `fromFetch` alone.

The lanes set (`mergeMap`, `switchMap`, `exhaustMap`, `concatMap`,
`createStream`, `retry`) is budgeted at 2,240 gzipped bytes, about 4% above
its size, so growth there needs a reason. Most of its weight is the
constant-time queue, `drain`'s single-observer error handling, and `retry`'s
backoff and delay-stream support.

To accept intended growth, run `node scripts/size.mjs --update` and say why
in the commit message.
