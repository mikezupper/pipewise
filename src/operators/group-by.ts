import { drain } from "../internal/drain.js";
import { operator } from "../internal/operator.js";
import { watchFirst } from "../internal/watch-first.js";
import { createStream } from "../sources/create-stream.js";
import { external, type External } from "../sources/external.js";
import type { Observable, Operator } from "../types.js";

/** A stream of the values that share one `key`, emitted by `groupBy()`. */
export type GroupedStream<K, T> = Observable<T> & { readonly key: K };

/** Options for `groupBy()`. */
export interface GroupByOptions<T, K, E> {
  /** Maps each value before it enters its group. */
  readonly element?: (value: T) => E;
  /** Closes a group when the returned stream emits; a later value with the same key opens a new group. */
  readonly duration?: (group: GroupedStream<K, E>) => Observable<unknown>;
}

/**
 * Splits values into groups by `keySelector`, emitting each group as a stream
 * with a `key` property the first time its key appears. Groups complete or
 * error with the source. A `duration` stream that errors ends only its own
 * group, with that error. Values in a group nobody reads are queued.
 *
 * @example
 * orders.pipeThrough(groupBy((o) => o.customerId)).pipeThrough(mergeMap((g) => g.pipeThrough(count())));
 */
export function groupBy<T, K, E = T>(
  keySelector: (value: T) => K,
  options: GroupByOptions<T, K, E> = {},
): Operator<T, GroupedStream<K, E>> {
  const { element, duration } = options;
  return operator((source) =>
    createStream<GroupedStream<K, E>>(async (subscriber) => {
      const groups = new Map<K, External<E>>();
      const endAll = (finish: (group: External<E>) => void): void => {
        for (const group of groups.values()) finish(group);
        groups.clear();
      };
      const open = (key: K): External<E> => {
        const group = external<E>();
        groups.set(key, group);
        const stream = Object.assign(group.observable, { key }) as GroupedStream<K, E>;
        subscriber.next(stream);
        if (duration) {
          watchFirst(duration(stream), subscriber.signal).fired.then(
            (fired) => {
              if (!fired || groups.get(key) !== group) return;
              groups.delete(key);
              group.complete();
            },
            (error: unknown) => {
              // As in RxJS, a duration error ends only its own group.
              if (groups.get(key) === group) groups.delete(key);
              group.error(error);
            },
          );
        }
        return group;
      };
      subscriber.signal.addEventListener(
        "abort",
        () => {
          endAll((group) => {
            group.complete();
          });
        },
        { once: true },
      );
      try {
        await drain(
          source,
          (value) => {
            const key = keySelector(value);
            const group = groups.get(key) ?? open(key);
            group.next(element ? element(value) : (value as unknown as E));
          },
          subscriber.signal,
        );
      } catch (error) {
        endAll((group) => {
          group.error(error);
        });
        throw error;
      }
      endAll((group) => {
        group.complete();
      });
      subscriber.complete();
    }),
  );
}
