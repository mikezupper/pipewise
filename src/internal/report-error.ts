/**
 * Surfaces an error that has nowhere to go, such as a teardown function that
 * throws after its stream has already ended. Never swallowed silently.
 */
export function reportError(error: unknown): void {
  queueMicrotask(() => {
    throw error;
  });
}
