/** The default comparer for `max()` and `min()`: orders with `<` and `>`. */
export function ascending<T>(a: T, b: T): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
