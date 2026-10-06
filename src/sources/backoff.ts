/** Options for `backoff()`. */
export interface BackoffOptions {
  /** Wait before the first retry, in milliseconds. */
  readonly baseMs: number;
  /** Multiplier applied for each further retry. Defaults to `2`. */
  readonly factor?: number;
  /** Longest wait, in milliseconds. Defaults to `Infinity`. */
  readonly maxMs?: number;
  /** Pick a random wait between 0 and the computed one ("full jitter"). Defaults to `false`. */
  readonly jitter?: boolean;
}

/**
 * Builds an exponential backoff schedule for `retry()`'s `delay`: `baseMs`,
 * then multiplied by `factor` for each retry, capped at `maxMs`. With
 * `jitter`, each wait is randomized so many clients do not retry in step.
 *
 * @example
 * retry(connect, { count: 6, delay: backoff({ baseMs: 100, maxMs: 1000 }) }); // 100, 200, 400, 800, 1000, 1000 ms
 */
export function backoff(options: BackoffOptions): (error: unknown, retryCount: number) => number {
  const { baseMs, factor = 2, maxMs = Infinity, jitter = false } = options;
  if (!(baseMs >= 0 && factor >= 1 && maxMs >= 0)) {
    throw new RangeError("backoff needs baseMs >= 0, factor >= 1, and maxMs >= 0");
  }
  return (_error, retryCount) => {
    const wait = Math.min(maxMs, baseMs * factor ** (retryCount - 1));
    return jitter ? Math.random() * wait : wait;
  };
}
