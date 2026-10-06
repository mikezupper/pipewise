import { operator } from "../internal/operator.js";
import type { Observable, Operator } from "../types.js";

/**
 * Packages part of a pipeline as one reusable operator.
 *
 * @example
 * const parseJson = subchain((lines: Observable<string>) =>
 *   lines.pipeThrough(filter((l) => l !== "")).pipeThrough(map((l) => JSON.parse(l))),
 * );
 * lines.pipeThrough(parseJson);
 */
export function subchain<In, Out>(
  f: (source: Observable<In>) => Observable<Out>,
): Operator<In, Out> {
  return operator(f);
}
