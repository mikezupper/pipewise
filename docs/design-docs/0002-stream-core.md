# 0002: One core for every multi-input operator

**Status:** Accepted.

## Context

An operator that reads several streams must propagate errors, cancel its
inputs, and respect demand. Written separately in each operator, every such
loop is a chance to forget one: a failing input leaves the output hanging
with an unhandled rejection, or cancelling the output leaves inputs running.

## Decision

Every such operator is built from two primitives. `createStream` owns the
output's lifetime and exposes it as an `AbortSignal`. `drain` reads one
input and cancels it when that signal aborts. Because operators share the
mechanism, a fix to it fixes all of them, and one contract test covers all of them.

## Consequences

- Operators are short; most are under 50 lines.
- Push sources made with `createStream` queue values that nobody reads. That
  matches what the platform does for event sources, and is documented on each one.
- A stream that errors still delivers the values it emitted first, because
  `createStream` defers the error until the queue drains.
