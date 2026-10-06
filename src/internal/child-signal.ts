/**
 * Returns a controller whose signal also aborts when `parent` aborts.
 * Lets an operator stop one inner stream without stopping the whole output.
 */
export function childController(parent: AbortSignal): AbortController {
  const child = new AbortController();
  if (parent.aborted) {
    child.abort(parent.reason);
    return child;
  }
  const onAbort = (): void => {
    child.abort(parent.reason);
  };
  parent.addEventListener("abort", onAbort, { once: true });
  child.signal.addEventListener(
    "abort",
    () => {
      parent.removeEventListener("abort", onAbort);
    },
    { once: true },
  );
  return child;
}
