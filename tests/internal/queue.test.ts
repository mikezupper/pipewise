import { expect, it } from "vitest";
import { Queue } from "../../src/internal/queue.js";

it("preserves FIFO order through compaction and reuse, including undefined values", () => {
  const queue = new Queue<number | undefined>();
  expect(queue.shift()).toBeUndefined();
  for (let i = 0; i < 4096; i++) queue.push(i);
  for (let i = 0; i < 3000; i++) expect(queue.shift()).toBe(i);
  queue.push(undefined);
  expect(queue.length).toBe(1097);
  for (let i = 3000; i < 4096; i++) expect(queue.shift()).toBe(i);
  expect(queue.shift()).toBeUndefined();
  for (let i = 0; i < 4096; i++) queue.push(i);
  queue.clear();
  queue.push(7);
  expect(queue.shift()).toBe(7);
  expect(queue.length).toBe(0);
  queue.push(8);
  expect(queue.shift()).toBe(8);
});
