# 0001: Follow RxJS names where streams allow

**Status:** Accepted.

## Context

Most people who reach for stream operators know RxJS. If a library invents
its own names, they must look up every one; if it reuses an RxJS name for
different behaviour, they are misled. Aliases double the surface to learn.

## Decision

- If RxJS has the operator with the same behaviour, use its name and argument
  order.
- If streams force different behaviour, change the signature or the name.
  Streams are single-use, so `retry` takes a factory, and the infinite source
  is `repeatValue` because RxJS's `repeat` resubscribes.
- Remove aliases; keep the RxJS name.
- Follow RxJS's error semantics: `first`, `last`, and `single` throw
  `EmptyError`, and `tap` lets exceptions propagate.

## Consequences

Where pipewise must differ, the JSDoc says so: `retry` and `repeat` take a
factory, `share()` returns a branch factory, `sequenceEqual` passes values to
its comparator in source order, and `shareReplay` rejects invalid sizes.
