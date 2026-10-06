# Design docs

Decisions that shaped the library, with the reasoning behind them. Add one
when a choice would surprise a new maintainer.

| #                              | Decision                                                           | Status   |
| ------------------------------ | ------------------------------------------------------------------ | -------- |
| [0001](0001-rxjs-naming.md)    | Follow RxJS names where streams allow                              | Accepted |
| [0002](0002-stream-core.md)    | One core (`createStream` + `drain`) for every multi-input operator | Accepted |
| [0003](0003-share-lockstep.md) | `share()` reads in lockstep with the slowest branch                | Accepted |
| [0004](0004-positioning.md)    | Position pipewise as operators for streaming responses             | Accepted |
