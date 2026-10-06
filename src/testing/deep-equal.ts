/**
 * Structural equality for test values: primitives by `Object.is`, arrays and
 * plain objects by their contents, `Date`s by time, `Error`s by name and message.
 *
 * @example
 * deepEqual({ a: [1, 2] }, { a: [1, 2] }); // true
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }
  if (a instanceof Error || b instanceof Error) {
    return a instanceof Error && b instanceof Error && a.name === b.name && a.message === b.message;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(
    (key) =>
      Object.hasOwn(b, key) &&
      deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
}
