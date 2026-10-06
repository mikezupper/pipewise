/**
 * Behaviour every operator that reads more than one stream must share:
 *   1. An error from any input reaches the output, and the other inputs are cancelled.
 *   2. Cancelling the output cancels every input.
 * Add each new multi-input operator to CASES.
 */
import { describe, expect, it } from "vitest";
import {
  responseText,
  distinct,
  bounded,
  concatWith,
  raceWith,
  onErrorResumeNextWith,
  withLatestFrom,
  sequenceEqual,
  expand,
  groupBy,
  mergeScan,
  switchScan,
  audit,
  auditTime,
  bufferTime,
  bufferToggle,
  bufferWhen,
  debounce,
  delayWhen,
  sampleTime,
  skipUntil,
  throttle,
  windowCount,
  windowTime,
  windowToggle,
  windowWhen,
  buffer,
  catchError,
  collect,
  combineLatest,
  combineLatestWith,
  concat,
  concatMap,
  debounceTime,
  delay,
  exhaustMap,
  finalize,
  forkJoin,
  merge,
  mergeMap,
  mergeWith,
  onErrorResumeNext,
  race,
  sample,
  switchMap,
  takeUntil,
  throttleTime,
  timeout,
  window,
  zip,
  zipWith,
} from "../src/index.js";
import { probe, waitTicks, type Probe } from "./helpers.js";

interface Case {
  readonly name: string;
  /** Builds the output from fresh inputs. `inputs[0]` is the one that will error. */
  readonly build: (inputs: Probe<number>[]) => ReadableStream<unknown>;
  readonly inputs: number;
  /** Primes inputs so every one of them is being read before the test acts. */
  readonly prime?: (inputs: Probe<number>[]) => void;
  /** The operator recovers from input errors by design. */
  readonly swallowsErrors?: boolean;
}

const op =
  (
    f: (
      others: ReadableStream<number>[],
    ) =>
      | TransformStream<number, unknown>
      | { writable: WritableStream<number>; readable: ReadableStream<unknown> },
  ) =>
  ([first, ...rest]: Probe<number>[]): ReadableStream<unknown> =>
    (first as Probe<number>).stream.pipeThrough(f(rest.map((p) => p.stream)));

const CASES: Case[] = [
  { name: "distinct with flushes", inputs: 2, build: op(([f]) => distinct(undefined, f)) },
  { name: "merge", inputs: 3, build: (i) => merge(...i.map((p) => p.stream)) },
  { name: "concat", inputs: 3, build: (i) => concat(...i.map((p) => p.stream)) },
  { name: "combineLatest", inputs: 3, build: (i) => combineLatest(...i.map((p) => p.stream)) },
  { name: "zip", inputs: 3, build: (i) => zip(...i.map((p) => p.stream)) },
  { name: "forkJoin", inputs: 3, build: (i) => forkJoin(...i.map((p) => p.stream)) },
  { name: "race", inputs: 3, build: (i) => race(...i.map((p) => p.stream)) },
  { name: "mergeWith", inputs: 2, build: op((o) => mergeWith(...o)) },
  { name: "zipWith", inputs: 2, build: op((o) => zipWith(...o)) },
  { name: "combineLatestWith", inputs: 2, build: op((o) => combineLatestWith(...o)) },
  { name: "takeUntil", inputs: 2, build: op(([n]) => takeUntil(n as ReadableStream<number>)) },
  { name: "buffer", inputs: 2, build: op(([n]) => buffer(n as ReadableStream<number>)) },
  { name: "window", inputs: 2, build: op(([n]) => window(n as ReadableStream<number>)) },
  { name: "sample", inputs: 2, build: op(([n]) => sample(n as ReadableStream<number>)) },
  {
    name: "catchError",
    inputs: 1,
    swallowsErrors: true,
    build: op(() => catchError(() => new ReadableStream<number>())),
  },
  {
    name: "onErrorResumeNext",
    inputs: 3,
    swallowsErrors: true,
    build: (i) => onErrorResumeNext(...i.map((p) => p.stream)),
  },
  { name: "finalize", inputs: 1, build: op(() => finalize(() => undefined)) },
  { name: "debounceTime", inputs: 1, build: op(() => debounceTime(1)) },
  { name: "throttleTime", inputs: 1, build: op(() => throttleTime(1)) },
  { name: "delay", inputs: 1, build: op(() => delay(1)) },
  { name: "timeout", inputs: 1, build: op(() => timeout(60_000)) },
  { name: "skipUntil", inputs: 2, build: op(([n]) => skipUntil(n as ReadableStream<number>)) },
  {
    name: "bufferWhen",
    inputs: 2,
    build: op(([c]) => bufferWhen(() => c as ReadableStream<number>)),
  },
  {
    name: "windowWhen",
    inputs: 2,
    build: op(([c]) => windowWhen(() => c as ReadableStream<number>)),
  },
  { name: "bufferTime", inputs: 1, build: op(() => bufferTime(60_000)) },
  { name: "windowTime", inputs: 1, build: op(() => windowTime(60_000)) },
  { name: "windowCount", inputs: 1, build: op(() => windowCount(2)) },
  { name: "auditTime", inputs: 1, build: op(() => auditTime(60_000)) },
  { name: "sampleTime", inputs: 1, build: op(() => sampleTime(60_000)) },
  {
    name: "audit",
    inputs: 2,
    prime: (i) => i[0]?.next(0),
    build: op(([d]) => audit(() => d as ReadableStream<number>)),
  },
  {
    name: "debounce",
    inputs: 2,
    prime: (i) => i[0]?.next(0),
    build: op(([d]) => debounce(() => d as ReadableStream<number>)),
  },
  {
    name: "throttle",
    inputs: 2,
    prime: (i) => i[0]?.next(0),
    build: op(([d]) => throttle(() => d as ReadableStream<number>)),
  },
  {
    name: "delayWhen",
    inputs: 2,
    prime: (i) => i[0]?.next(0),
    build: op(([d]) => delayWhen(() => d as ReadableStream<number>)),
  },
  {
    name: "bufferToggle",
    inputs: 3,
    prime: (i) => i[1]?.next(0),
    build: op(([o, c]) =>
      bufferToggle(o as ReadableStream<number>, () => c as ReadableStream<number>),
    ),
  },
  {
    name: "windowToggle",
    inputs: 3,
    prime: (i) => i[1]?.next(0),
    build: op(([o, c]) =>
      windowToggle(o as ReadableStream<number>, () => c as ReadableStream<number>),
    ),
  },
  { name: "concatWith", inputs: 3, build: op((o) => concatWith(...o)) },
  { name: "raceWith", inputs: 3, build: op((o) => raceWith(...o)) },
  {
    name: "onErrorResumeNextWith",
    inputs: 3,
    swallowsErrors: true,
    build: op((o) => onErrorResumeNextWith(...o)),
  },
  { name: "withLatestFrom", inputs: 3, build: op((o) => withLatestFrom(...o)) },
  {
    name: "sequenceEqual",
    inputs: 2,
    build: op(([b]) => sequenceEqual(b as ReadableStream<number>)),
  },
  { name: "groupBy", inputs: 1, build: op(() => groupBy((n: number) => n % 2)) },
  { name: "bounded", inputs: 1, build: op(() => bounded(10)) },
  {
    name: "responseText",
    inputs: 1,
    prime: (i) => i[0]?.next(new Response(new ReadableStream()) as unknown as number),
    build: op(() => responseText() as unknown as TransformStream<number, unknown>),
  },
];

/** Higher-order operators: input 0 is the outer stream, inputs 1+ are inner streams it emits. */
const HIGHER_ORDER: Case[] = [
  { name: "switchMap", inputs: 2, build: higher((p) => switchMap(p)) },
  { name: "exhaustMap", inputs: 2, build: higher((p) => exhaustMap(p)) },
  {
    name: "exhaustMap with onDrop",
    inputs: 2,
    build: higher((p) => exhaustMap(p, { onDrop: () => undefined })),
  },
  { name: "mergeMap", inputs: 2, build: higher((p) => mergeMap(p)) },
  { name: "concatMap", inputs: 2, build: higher((p) => concatMap(p)) },
  { name: "expand", inputs: 2, build: higher((p) => expand(p)) },
  { name: "mergeScan", inputs: 2, build: higher((p) => mergeScan((_acc: number, v) => p(v), 0)) },
  { name: "switchScan", inputs: 2, build: higher((p) => switchScan((_acc: number, v) => p(v), 0)) },
].map((c) => ({ ...c, prime: (i) => i[0]?.next(0) }));

function higher(
  f: (project: (v: number) => ReadableStream<number>) => {
    writable: WritableStream<number>;
    readable: ReadableStream<number>;
  },
): (inputs: Probe<number>[]) => ReadableStream<unknown> {
  return ([outer, ...inners]) => {
    let next = 0;
    const project = (): ReadableStream<number> => (inners[next++] ?? probe<number>()).stream;
    return (outer as Probe<number>).stream.pipeThrough(f(project));
  };
}

describe.each([...CASES, ...HIGHER_ORDER])("$name contract", (c) => {
  const setup = (): { inputs: Probe<number>[]; output: ReadableStream<unknown> } => {
    const inputs = Array.from({ length: c.inputs }, () => probe<number>());
    const output = c.build(inputs);
    return { inputs, output };
  };

  if (!c.swallowsErrors)
    it.each(Array.from({ length: c.inputs }, (_, index) => index))(
      "propagates an error from input %i",
      async (index) => {
        const { inputs, output } = setup();
        const result = collect(output);
        await waitTicks();
        c.prime?.(inputs);
        await waitTicks();
        if (c.name === "concat" || c.name === "concatWith") {
          for (let earlier = 0; earlier < index; earlier++) inputs[earlier]?.complete();
          await waitTicks(60);
        }
        inputs[index]?.error(new Error("input failed"));
        await expect(result).rejects.toThrow("input failed");
      },
    );

  it("cancels every input that is being read when the output is cancelled", async () => {
    const { inputs, output } = setup();
    const reader = output.getReader();
    void reader.read().catch(() => undefined);
    await waitTicks();
    c.prime?.(inputs);
    await waitTicks();
    await reader.cancel("stop");
    await waitTicks();
    const uncancelled = inputs.map((p, i) => (p.cancelled ? null : i)).filter((i) => i !== null);
    expect(uncancelled, `inputs not cancelled: ${uncancelled.join(", ")}`).toEqual([]);
  });
});
