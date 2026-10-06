/**
 * A value emitted just before an upstream error must still reach the consumer
 * when it reads through pipeTo, which reads ahead differently in WebKit.
 */
import { describe, expect, it } from "vitest";
import {
  catchError,
  createStream,
  empty,
  finalize,
  never,
  takeUntil,
  timeout,
  type Operator,
} from "../../src/index.js";

const failing = (): ReadableStream<number> =>
  createStream<number>((s) => {
    s.next(1);
    s.next(2);
    s.error(new Error("boom"));
  });

const piped = async (
  op: Operator<number, number>,
): Promise<{ values: number[]; error?: unknown }> => {
  const values: number[] = [];
  try {
    await failing()
      .pipeThrough(op)
      .pipeTo(
        new WritableStream({
          write(value) {
            values.push(value);
          },
        }),
      );
    return { values };
  } catch (error) {
    return { values, error };
  }
};

describe.each([
  { name: "catchError", op: () => catchError<number, number>(() => empty()), errors: false },
  { name: "finalize", op: () => finalize<number>(() => undefined), errors: true },
  { name: "takeUntil", op: () => takeUntil<number>(never()), errors: true },
  { name: "timeout", op: () => timeout<number>(60_000), errors: true },
])("$name", ({ op, errors }) => {
  it("delivers values emitted before the error", async () => {
    const { values, error } = await piped(op());
    expect(values).toEqual([1, 2]);
    if (errors) expect(String(error)).toMatch(/boom/);
    else expect(error).toBeUndefined();
  });
});
