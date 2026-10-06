# 0003: `share()` reads in lockstep

**Status:** Accepted.

## Context

Several consumers sometimes need the same values. The platform offers
`ReadableStream.tee()`, which buffers without limit for the slower branch:
one stalled consumer can grow memory until the process dies.

## Decision

`share(source)` returns a function that creates branches. It reads the next
value only after every branch has asked for one, so memory use stays constant.
When the last branch is cancelled, the source is cancelled.

## Consequences

- The slowest branch sets the pace for all of them. A branch that never reads
  stalls the rest; cancel branches you stop using.
- Branches created after the source ends complete immediately, because a
  stream cannot be read twice.
