# pipewise

Operators for streaming responses.

`fetch` bodies, LLM token streams, and edge-function responses all arrive as
Web Streams. pipewise gives those streams the operators that streaming code
keeps rewriting by hand: parse Server-Sent Events and NDJSON, cancel the
request when the user asks again, merge, retry, time out, and move work to a
Worker. It adds no stream type of its own; every operator plugs into the
platform's `pipeThrough()`. It has no dependencies and costs 0.5–2.5 kB for a
typical import. It is tested in browsers, Node 20+, Deno, and Bun, and uses
only standard Web APIs, so it also suits edge runtimes.

```sh
npm install pipewise
```

An edge function streams tokens as Server-Sent Events, and a client reads
them back:

```js
import { collect, fromIterable, map, of, responseText, sse, toResponse, toSse } from "pipewise";

// Server: an edge function or route handler.
function handler() {
  const tokens = fromIterable(["Stream", "ing ", "works"]);
  return toResponse(tokens.pipeThrough(toSse()), {
    headers: { "content-type": "text/event-stream" },
  });
}

// Client: use fromFetch("/chat") where this calls the handler directly.
const text = await collect(
  of(handler())
    .pipeThrough(responseText())
    .pipeThrough(sse())
    .pipeThrough(map((event) => event.data)),
);
console.log(text.join("")); // Streaming works
```

## Is pipewise for you?

pipewise fits code whose data already arrives as a stream, a few hundred or a
few thousand values a second:

- **AI chat and agent frontends** that render a model's answer as it streams,
  and cancel it when the user sends a new prompt.
- **Streaming proxies and edge functions** that call upstream APIs, reshape
  their streams, and stream the result to a client.
- **Network clients** that read Server-Sent Events, NDJSON, or CSV over `fetch`
  or WebSocket, and need backpressure and clean cancellation.

It is the wrong tool for crunching large in-memory datasets. Web Streams
spend 4–34 µs on every value at every operator, depending on the runtime, so a
million values through five operators takes seconds; RxJS is 50–120× faster
at that, and a plain loop faster still. pipewise is also not a replacement for RxJS in UI-only
code: there, RxJS's maturity and speed win. The numbers are in
[docs/performance.md](docs/performance.md).

## Why

Streaming has become the normal way to deliver data on the web. A model's
answer arrives token by token; an edge function returns a body that is still
being written; a Worker receives a stream it can read without blocking the
page. The platform's model for all of these is the `ReadableStream`, and it is
a good one: the reader pulls, so a slow consumer slows the producer;
cancellation travels upstream; errors travel downstream.

What the platform lacks is vocabulary. Parsing `text/event-stream` correctly,
aborting the previous request when a new prompt arrives, merging a tool's
output into an answer, or retrying a dropped connection each take a page of
hand-written stream code. RxJS has that vocabulary, but its `Observable` is a
second stream type: every boundary with `fetch`, `Response`, or a Worker needs
a conversion, and its operators know nothing about backpressure.

pipewise is that vocabulary for the platform's own streams.

## A streaming chat client

This client sends a prompt, renders the answer as it streams, and abandons the
old answer, request included, when a new prompt arrives:

```js
import {
  fromEvent,
  fromFetch,
  map,
  responseText,
  scan,
  sse,
  subscribe,
  switchMap,
  throttleTime,
} from "pipewise";

const form = document.querySelector("form");
const output = document.querySelector("output");

fromEvent(form, "submit")
  .pipeThrough(
    map((event) => {
      event.preventDefault();
      return form.elements.prompt.value;
    }),
  )
  .pipeThrough(
    switchMap((prompt) =>
      fromFetch("/chat", { method: "POST", body: JSON.stringify({ prompt }) })
        .pipeThrough(responseText())
        .pipeThrough(sse())
        .pipeThrough(scan((answer, event) => answer + event.data, "")),
    ),
  )
  .pipeThrough(throttleTime(50, { trailing: true }))
  .pipeTo(subscribe((answer) => (output.textContent = answer)));
```

When a second prompt arrives, `switchMap` cancels the first answer's stream.
Cancellation travels up through `sse()` and `responseText()` to the response
body, which closes the connection. `throttleTime` keeps rendering to at most
20 frames a second however fast tokens arrive.

[examples/stream-chat](examples/stream-chat) is the full version: this
client plus a server that streams from a mock model or Claude, runs on Node,
Deno, and Bun, and stops the model when the client lets go. Run it with
`pnpm example`.

## How it works

Operators with one input and no timers, such as `map` and `sse`, are
`TransformStream`s, so the platform handles backpressure, cancellation, and
errors for them.

Operators that read several streams, such as `switchMap`, `merge`, and
`takeUntil`, cannot be `TransformStream`s. They are all built from two
primitives. `createStream()` turns a push-style producer into a
`ReadableStream` and exposes its lifetime as an `AbortSignal`. `drain()` reads
one input and cancels it when that signal aborts. Because every such operator
shares the mechanism, every one of them gives the same guarantees, which a
contract test checks:

- **Cancellation reaches every input.** Cancelling the output, or ending it
  with `take()`, cancels the operator's inputs: requests close, listeners are
  removed, timers stop.
- **Errors are never lost.** An error from any input errors the output, even
  while the operator is busy with another value. Values emitted before the
  error are still delivered.
- **Demand flows upstream where it can.** Pull sources produce a value only
  when it is read. Push sources such as `fromEvent` cannot be paused; values
  nobody has read yet wait in a queue, which you can bound with
  `{ buffer, overflow }`.

Workers extend the same guarantees across threads: `inWorker()` carries
values over a `MessagePort` with one credit per read, so backpressure,
cancellation, and errors cross the boundary.
[ARCHITECTURE.md](ARCHITECTURE.md) explains the design.

| Kind                             | Examples                                                                                                          |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Streaming I/O                    | `fromFetch`, `responseText`, `sse`, `toSse`, `toResponse`, `ndjson`, `lines`, `csv`                               |
| Sources                          | `of`, `from`, `fromEvent`, `interval`, `createStream`, `defer`, `retry`, `share`                                  |
| Combiners                        | `merge`, `concat`, `zip`, `combineLatest`, `race`                                                                 |
| Operators                        | `map`, `filter`, `scan`, `switchMap`, `mergeMap`, `takeUntil`, `debounceTime`, `timeout`, `catchError`, `bounded` |
| Sinks                            | `subscribe`, `collect`, `firstValueFrom`, `toSubscribable`                                                        |
| Workers                          | `inWorker`, `serveOperators`, `sendStream`, `receiveStream`                                                       |
| Testing, from `pipewise/testing` | `marbles`, `probe`, `flushMicrotasks`                                                                             |

There are 146 functions in all; the [API catalog](docs/generated/operators.md)
lists every one.

## Conventions

- **RxJS names mean RxJS behaviour.** Where streams force a difference, the
  name or signature changes. A stream can be read only once, so `retry` takes
  a factory, and `share()` returns a function that creates branches:

  ```js
  import { share, interval, take, collect } from "pipewise";

  const branch = share(interval(10).pipeThrough(take(3)));
  const [a, b] = await Promise.all([collect(branch()), collect(branch())]);
  console.log(a, b); // [0, 1, 2] [0, 1, 2]
  ```

- **One name per function.** There are no aliases.
- **Errors are classes you can check.** `HttpError` for non-2xx responses,
  `TimeoutError`, `EmptyError`, `BufferOverflowError`, and others are exported,
  so you can test them with `instanceof`.
- **RxJS interop is direct.** RxJS's `from()` accepts a pipewise stream, and
  `fromSubscribable()` accepts an RxJS `Observable`.

Contributor conventions are in [AGENTS.md](AGENTS.md) and
[docs/conventions.md](docs/conventions.md).

## Configuration

pipewise has no global configuration. Behaviour is set per call:

| Function                                                                                                  | Options                                                                                                           |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `fromFetch(input, init)`                                                                                  | Standard `fetch` options; `init.signal` aborts the request                                                        |
| `responseText(options)`                                                                                   | `allowErrorStatus` streams non-2xx bodies instead of throwing `HttpError`                                         |
| `toResponse(stream, init)`                                                                                | Standard `Response` options, such as `headers`                                                                    |
| Push sources: `createStream`, `external`, `fromEvent`, `interval`, `fromEventPattern`, `fromSubscribable` | Queue bound: `buffer` (default `Infinity`) and `overflow`: `"dropOldest"`, `"dropNewest"`, or `"error"` (default) |
| `bounded(buffer, overflow)`                                                                               | The same bound, anywhere in a pipeline                                                                            |
| `retry(factory, options)`                                                                                 | `count` (default `Infinity`), `delay` in ms (default `0`)                                                         |
| `timeout(config)`                                                                                         | Milliseconds, or `{ first, each, with }`                                                                          |
| `mergeMap(project, concurrent)`                                                                           | Maximum inner streams read at once (default `Infinity`)                                                           |
| `throttleTime(ms, options)`                                                                               | `leading` (default `true`), `trailing` (default `false`)                                                          |
| `inWorker(worker, name, transfer)`                                                                        | `transfer` moves objects such as `ArrayBuffer`s instead of copying them                                           |

The package is ESM only and needs ES2022 and Web Streams. JavaScript users
need nothing else. TypeScript users get the bundled type declarations
automatically.

## Building

You need Node 22.18 or later and pnpm 10 (`corepack enable` provides it).

```sh
pnpm install
pnpm exec playwright install chromium firefox webkit
pnpm check
```

`pnpm check` is the gate for every change. It runs Prettier, ESLint, the
TypeScript compiler, and the tests in Node, Chromium, Firefox, and WebKit. It
then builds the package, checks the bundle-size budget, and installs the
package in a scratch project to prove it imports from plain JavaScript.
`pnpm test:runtimes` runs a smoke test of the built package, including a real
worker thread, on Node 20, Deno, and Bun; it needs Docker. `pnpm bench`
compares pipewise with RxJS. `pnpm build` alone writes `dist/`: one ESM file
per module, with `.d.ts` declarations and source maps.

## Deployment

CI and releases run as GitHub Actions on a self-hosted runner that lives in
this repository and runs during development sessions. Pushing a tag such as
`v1.0.0` that matches `package.json` runs the full check, publishes to npm,
and creates a GitHub release. Runner setup, the npm token, and the release
steps are in [docs/deployment.md](docs/deployment.md).

## License

MIT; see [LICENSE](LICENSE).
