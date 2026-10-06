/**
 * Lets pending promise callbacks run, so work that streams schedule (such as
 * an inner stream started by `mergeMap` or `switchMap`) has begun before the
 * test continues. Works under fake timers; no `setTimeout(0)` needed.
 *
 * @example
 * source.next(command);
 * await flushMicrotasks();
 * expect(driver.started).toBe(true);
 */
export async function flushMicrotasks(rounds: number = 20): Promise<void> {
  for (let i = 0; i < rounds; i++) await Promise.resolve();
}
