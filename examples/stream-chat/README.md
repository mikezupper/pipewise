# Stream chat

A streaming chat app built with pipewise on both ends: an edge-style server
that streams a model's answer as Server-Sent Events, and a browser client
that renders it, cancels it, and logs what happens on the wire. Both halves
are plain JavaScript with no build step and no dependencies besides pipewise.

## Run it

From the repository root:

```sh
pnpm example
```

Then open <http://localhost:8787>. The server streams from a built-in mock
model. To stream from Claude instead, set an API key:

```sh
ANTHROPIC_API_KEY=sk-ant-... pnpm example
```

The same server runs on Deno and Bun after `pnpm build`:

```sh
deno run -A examples/stream-chat/server/main.mjs
bun examples/stream-chat/server/main.mjs
```

| Variable            | Default           | Effect                                                |
| ------------------- | ----------------- | ----------------------------------------------------- |
| `PORT`              | `8787`            | Port to listen on                                     |
| `MOCK_DELAY`        | `40`              | Milliseconds between mock tokens                      |
| `ANTHROPIC_API_KEY` | unset             | Stream from Claude through the Anthropic Messages API |
| `CLAUDE_MODEL`      | `claude-opus-5-5` | Which Claude model to use                             |

## What to try

- **Ask again before an answer finishes.** The wire log shows the old request
  cancelled, and the server logs that the model stopped generating.
- **Press Stop.** Same cancellation, triggered by `takeUntil`.
- **Ask something containing `/fail`.** The mock model fails partway; the
  server turns the failure into an `error` event and the page shows it.

## Where each guarantee shows up

| What you see                                     | Code                                                                                               | pipewise                                             |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| A new prompt abandons the old answer             | [client/app.mjs](client/app.mjs)                                                                   | `switchMap`                                          |
| Stop ends the answer                             | [client/app.mjs](client/app.mjs)                                                                   | `takeUntil`                                          |
| The server stops the model when the page lets go | [server/node-adapter.mjs](server/node-adapter.mjs), [server/mock-model.mjs](server/mock-model.mjs) | cancellation through `toResponse` and `createStream` |
| The answer and live metrics arrive on one stream | [server/chat.mjs](server/chat.mjs)                                                                 | `share`, `scan`, `auditTime`, `merge`, `toSse`       |
| A failing model becomes a readable error         | [server/chat.mjs](server/chat.mjs)                                                                 | `catchError`                                         |
| Claude's raw event stream becomes text           | [server/claude-model.mjs](server/claude-model.mjs)                                                 | `fromFetch`, `responseText`, `sse`, `retry`          |
| Rendering keeps up however fast tokens arrive    | [client/app.mjs](client/app.mjs)                                                                   | `throttleTime`                                       |

The Claude adapter calls the Messages API with plain `fetch` on purpose,
because parsing its event stream with pipewise is the point of the example.
An application that only needs Claude's answers can use the
`@anthropic-ai/sdk` package instead. The adapter enables Anthropic's
server-side refusal fallbacks (`fallbacks: "default"`) and retries only the
connection, never a stream that has already sent text.

## Tests

- `pnpm test` runs [tests/](tests/): the server handler, the mock model, and
  the Claude adapter against a replayed event stream.
- `pnpm example:e2e` builds the package, drives the page in Chromium, checks
  the server saw each cancellation, and streams one answer on Bun and Deno
  (needs Docker for Deno).
