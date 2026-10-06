import type { Observable } from "../types.js";

/**
 * Errors with the value `errorFactory` returns, when the first value is read.
 *
 * @example
 * throwError(() => new Error("offline")).pipeThrough(catchError(() => of(cached)));
 */
export function throwError<T = never>(errorFactory: () => unknown): Observable<T> {
  return new ReadableStream<T>(
    {
      pull(controller) {
        controller.error(errorFactory());
      },
    },
    { highWaterMark: 0 },
  );
}
