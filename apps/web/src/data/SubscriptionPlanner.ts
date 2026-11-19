export type SubscriptionLimits = {
  /** Symbols one connection may be subscribed to; extra ones wait for free slots. */
  maxStreams: number
  /** Symbols per change (one control frame). */
  maxPerChange: number
}

export type SubscriptionChange = { op: 'subscribe' | 'unsubscribe'; symbols: string[] }

/**
 * Pure bookkeeping for servers that take subscription changes as control
 * frames. Tracks what the app wants (`desired`) and what was requested on the
 * current connection (`active`), and turns the difference into one change at
 * a time, within the limits. Knows nothing about sockets or timers.
 */
export class SubscriptionPlanner {
  private readonly desired = new Set<string>()
  private readonly active = new Set<string>()
  private warnedOverLimit = false

  constructor(
    private readonly limits: SubscriptionLimits,
    /** Called once per planner when more symbols are wanted than `maxStreams` allows. */
    private readonly onOverLimit: (requested: number, maxStreams: number) => void = () => {},
  ) {}

  want(symbols: readonly string[]): void {
    for (const symbol of symbols) this.desired.add(symbol)
  }

  unwant(symbols: readonly string[]): void {
    for (const symbol of symbols) this.desired.delete(symbol)
  }

  /** Symbols currently requested from the server. */
  activeSymbols(): string[] {
    return [...this.active]
  }

  get activeCount(): number {
    return this.active.size
  }

  /**
   * The next change to send, already applied to `active`, or null when the
   * server has what the app wants. Unsubscribes go first, so freed slots are
   * available to the following subscribe.
   */
  next(): SubscriptionChange | null {
    const { maxStreams, maxPerChange } = this.limits
    const toRemove: string[] = []
    for (const symbol of this.active) {
      if (!this.desired.has(symbol)) toRemove.push(symbol)
      if (toRemove.length === maxPerChange) break
    }
    if (toRemove.length > 0) {
      for (const symbol of toRemove) this.active.delete(symbol)
      return { op: 'unsubscribe', symbols: toRemove }
    }

    const room = Math.min(maxStreams - this.active.size, maxPerChange)
    const toAdd: string[] = []
    let missing = 0
    for (const symbol of this.desired) {
      if (this.active.has(symbol)) continue
      missing += 1
      if (toAdd.length < room) toAdd.push(symbol)
    }
    if (this.active.size + missing > maxStreams && !this.warnedOverLimit) {
      this.warnedOverLimit = true
      this.onOverLimit(this.active.size + missing, maxStreams)
    }
    if (toAdd.length === 0) return null
    for (const symbol of toAdd) this.active.add(symbol)
    return { op: 'subscribe', symbols: toAdd }
  }

  /** The server did not take these subscriptions; forget them so a later change retries. */
  rejected(symbols: readonly string[]): void {
    for (const symbol of symbols) this.active.delete(symbol)
  }

  /** A new connection starts with nothing wanted or active. The over-limit warning stays one-shot. */
  reset(): void {
    this.desired.clear()
    this.active.clear()
  }
}
