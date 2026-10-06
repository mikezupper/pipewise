import { createTransform } from "../internal/transform.js";
import type { Notification, Operator } from "../types.js";

/**
 * Turns `Notification` objects back into values, an error, or completion.
 * The inverse of `materialize()`.
 *
 * @example
 * of<Notification<number>>({ kind: "N", value: 1 }, { kind: "C" }).pipeThrough(dematerialize()); // 1
 */
export function dematerialize<T>(): Operator<Notification<T>, T> {
  return createTransform<Notification<T>, T>({
    transform(notification, controller) {
      switch (notification.kind) {
        case "N":
          controller.enqueue(notification.value);
          return;
        case "E":
          controller.error(notification.error);
          return;
        case "C":
          controller.terminate();
      }
    },
  });
}
