export type BackoffOptions = {
  /** Delay before the first retry (ms). */
  baseMs: number
  /** Upper bound for a single delay (ms). */
  maxMs: number
}

export const DEFAULT_BACKOFF: BackoffOptions = { baseMs: 500, maxMs: 30_000 }

/**
 * Exponential backoff with "full jitter": a random delay in [0, min(max, base * 2^attempt)].
 * Jitter keeps many clients from reconnecting in lockstep after an outage.
 */
export function backoffDelay(
  attempt: number,
  { baseMs, maxMs }: BackoffOptions = DEFAULT_BACKOFF,
  random: () => number = Math.random,
): number {
  const cap = Math.min(maxMs, baseMs * 2 ** attempt)
  return Math.floor(random() * cap)
}
