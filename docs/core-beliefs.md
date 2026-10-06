# Core beliefs

pipewise is operators for streaming responses: the streams that `fetch`, LLM
APIs, edge runtimes, and Workers already produce. Judge a feature by whether it
helps people building streaming chat UIs, agent frontends, proxies, and edge
functions ([0004](design-docs/0004-positioning.md)).

These principles settle arguments. When two good options conflict, the one
higher on this list wins.

1. **The platform is the API.** A stream is a `ReadableStream` and an operator
   is a `TransformStream`-shaped pair. Users can mix pipewise with any other
   code that speaks Web Streams, and can stop using it one operator at a time.
2. **No silent failure.** Errors propagate; resources are released on every
   exit path; nothing is swallowed. A library that loses an error costs its
   users a day of debugging.
3. **Familiar beats clever.** Readers know RxJS. Use its names where behaviour
   matches, and a different name where streams force different behaviour.
   See [design-docs/0001](design-docs/0001-rxjs-naming.md).
4. **Zero dependencies, any runtime.** If it needs a package or a Node API,
   it does not belong in `src/`.
5. **Rules live in code.** A convention that matters gets a structural test
   with a fix-it message. Prose explains why; tests make sure.
6. **The repository is the memory.** Decisions go in `docs/design-docs/`,
   work in beads, knowledge in these docs. Nothing important lives only in a
   chat log or someone's head.
7. **Small, boring pieces.** One operator per file, under 150 lines. Shared
   mechanism lives once, in `src/internal/`.

## Out of scope

pipewise covers every RxJS 7.8 operator and creation function that maps onto
streams, except these:

- **Subjects and Subject-based multicasting** (`Subject`, `publish*`,
  `multicast`, `refCount`, `connect`, `connectable`). `external()`, `share()`,
  and `shareReplay()` cover the push and multicast cases without a stateful
  hybrid type.
- **Schedulers** (`observeOn`, `subscribeOn`). Web Streams already define when
  work runs. Time-based operators use timers directly.
- **Resubscription.** A stream can be read once. Operators that resubscribe
  in RxJS take a factory instead (`retry`, `repeat`).
- **Aliases RxJS deprecated** (`mapTo`, `pluck`, `flatMap`, `*MapTo`,
  `exhaust`, `combineAll`, `retryWhen`, `repeatWhen`, `timeoutWith`, the
  `partition` operator). Use `map`, `mergeMap`, `exhaustAll`,
  `combineLatestAll`, `retry`, `repeat`, `timeout({ with })`, and the
  `partition()` function.
- **Callback binders** (`bindCallback`, `bindNodeCallback`). `createStream()`
  and `fromAsyncFunction()` express the same thing directly.
- **Bulk in-memory processing.** Web Streams cost microseconds per value per
  operator; arrays and loops are the right tool for large datasets. See
  [performance.md](performance.md).
- **Result selectors** (the trailing `project` argument of `withLatestFrom`,
  `combineLatestAll`, `zipAll`). Pipe through `map()` instead.
