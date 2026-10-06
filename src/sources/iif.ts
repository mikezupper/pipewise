import { discardValue } from "../internal/cancel-stream.js";
import { cancelUnread } from "../internal/cancel-unread.js";
import { lazyStream } from "../internal/lazy-stream.js";
import type { Observable } from "../types.js";

/**
 * Calls `condition` when the first value is read, then mirrors `trueResult`
 * or `falseResult`. The stream not chosen is cancelled.
 *
 * @example
 * iif(() => navigator.onLine, fetchLatest(), of(cached));
 */
export function iif<T, F>(
  condition: () => boolean,
  trueResult: Observable<T>,
  falseResult: Observable<F>,
): Observable<T | F> {
  const discard = (): void => {
    cancelUnread([trueResult, falseResult]);
  };
  return lazyStream<T | F>(() => {
    let selected: boolean;
    try {
      selected = condition();
    } catch (reason) {
      discard();
      throw reason;
    }
    if (selected) {
      discardValue(falseResult);
      return trueResult;
    }
    discardValue(trueResult);
    return falseResult;
  }, discard);
}
