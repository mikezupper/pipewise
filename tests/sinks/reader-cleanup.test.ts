import { describe, expect, it } from "vitest";
import { EmptyError, firstValueFrom, lastValueFrom, of, throwError } from "../../src/index.js";

describe.each([firstValueFrom, lastValueFrom])("terminal sink cleanup", (sink) => {
  it("releases its reader after a value", async () => {
    const source = of(1);
    expect(await sink(source)).toBe(1);
    expect(source.locked).toBe(false);
  });

  it("releases its reader on empty completion", async () => {
    const source = of();
    await expect(sink(source)).rejects.toBeInstanceOf(EmptyError);
    expect(source.locked).toBe(false);
  });

  it("releases its reader on source error", async () => {
    const source = throwError(() => new Error("source failed"));
    await expect(sink(source)).rejects.toThrow("source failed");
    expect(source.locked).toBe(false);
  });
});

it("firstValueFrom releases the reader even if upstream cancellation rejects", async () => {
  const source = new ReadableStream<number>(
    {
      pull(controller) {
        controller.enqueue(1);
      },
      cancel() {
        throw new Error("cancel failed");
      },
    },
    { highWaterMark: 0 },
  );
  expect(await firstValueFrom(source)).toBe(1);
  expect(source.locked).toBe(false);
});
