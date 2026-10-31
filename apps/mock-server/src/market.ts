import { LIMITS, type LoadConfig, type RawTick } from './protocol'

export function symbolName(i: number): string {
  return `SYM${String(i).padStart(4, '0')}`
}

function clamp(value: number, { min, max }: { min: number; max: number }): number {
  return Math.min(max, Math.max(min, Math.round(value)))
}

/** Shared random-walk prices for the simulated symbols, plus the current load settings. */
export class Market {
  private config: LoadConfig
  private symbolList: string[] = []
  private readonly prices = new Map<string, number>()

  constructor(initial: LoadConfig, private readonly random: () => number = Math.random) {
    this.config = { tps: 0, symbols: 0 }
    this.configure(initial)
  }

  get tps(): number {
    return this.config.tps
  }

  get symbols(): readonly string[] {
    return this.symbolList
  }

  has(symbol: string): boolean {
    return this.prices.has(symbol)
  }

  /** Apply a (partial) config, clamped to protocol limits. Returns true if anything changed. */
  configure(patch: Partial<LoadConfig>): boolean {
    const next: LoadConfig = {
      tps: patch.tps === undefined ? this.config.tps : clamp(patch.tps, LIMITS.tps),
      symbols: patch.symbols === undefined ? this.config.symbols : clamp(patch.symbols, LIMITS.symbols),
    }
    if (next.tps === this.config.tps && next.symbols === this.config.symbols) return false

    if (next.symbols !== this.config.symbols) {
      this.symbolList = Array.from({ length: next.symbols }, (_, i) => symbolName(i))
      for (const s of this.symbolList) if (!this.prices.has(s)) this.prices.set(s, 100)
      for (const s of [...this.prices.keys()]) if (!this.symbolList.includes(s)) this.prices.delete(s)
    }
    this.config = next
    return true
  }

  /** Move the price of one symbol by up to ±0.1% and return the tick. */
  tick(symbol: string, now: number): RawTick {
    const prev = this.prices.get(symbol) ?? 100
    const p = Math.max(0.01, prev * (1 + (this.random() - 0.5) * 0.002))
    this.prices.set(symbol, p)
    return { s: symbol, p: Number(p.toFixed(4)), t: now }
  }
}

/**
 * Decides how many ticks are due for one client. Accumulates fractional ticks
 * between calls, so low rates (e.g. 30 TPS with a 10 ms interval) and timer
 * jitter still average out to the exact configured rate.
 */
export class TickPacer {
  private owed = 0
  private last: number

  constructor(now: number) {
    this.last = now
  }

  due(tps: number, now: number): number {
    const elapsed = Math.max(0, now - this.last)
    this.last = now
    // Cap catch-up to 1 s so a stalled event loop doesn't produce a huge burst.
    this.owed = Math.min(this.owed + (tps * elapsed) / 1000, Math.max(tps, 1))
    // Epsilon absorbs float drift (0.3 + 0.3 + ... must reach whole ticks).
    const count = Math.floor(this.owed + 1e-9)
    this.owed -= count
    return count
  }
}
