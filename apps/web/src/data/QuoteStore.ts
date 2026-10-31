import type { Quote, RawTick } from './types'

type Listener = () => void

/**
 * Quote state kept outside React. Listeners subscribe per symbol, so a batch
 * only wakes the components showing symbols that actually changed.
 */
export class QuoteStore {
  private readonly quotes = new Map<string, Quote>()
  private readonly listeners = new Map<string, Set<Listener>>()

  get(symbol: string): Quote | undefined {
    return this.quotes.get(symbol)
  }

  listen(symbol: string, listener: Listener): () => void {
    let set = this.listeners.get(symbol)
    if (!set) {
      set = new Set()
      this.listeners.set(symbol, set)
    }
    set.add(listener)
    return () => {
      set.delete(listener)
      if (set.size === 0) this.listeners.delete(symbol)
    }
  }

  /**
   * Apply a batch (at most one tick per symbol, as produced by the feed).
   * Ticks older than the stored one are dropped. Listeners are notified after
   * the whole batch is applied, so they always read a consistent state.
   */
  applyBatch(ticks: Iterable<RawTick>): void {
    const changed: string[] = []
    for (const tick of ticks) {
      const prev = this.quotes.get(tick.s)
      if (prev && tick.t < prev.t) continue
      if (prev && tick.t === prev.t && tick.p === prev.price) continue
      this.quotes.set(tick.s, {
        symbol: tick.s,
        price: tick.p,
        prevPrice: prev ? prev.price : tick.p,
        openPrice: prev ? prev.openPrice : tick.p,
        t: tick.t,
      })
      changed.push(tick.s)
    }
    for (const symbol of changed) {
      const set = this.listeners.get(symbol)
      if (set) for (const listener of set) listener()
    }
  }

  clear(): void {
    this.quotes.clear()
    for (const set of this.listeners.values()) for (const listener of set) listener()
  }
}
