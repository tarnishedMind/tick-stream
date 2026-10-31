import type { QuoteStore } from './QuoteStore'
import type { Adapter, ConnectionStatus, RawTick } from './types'

export type FrameScheduler = {
  request(cb: () => void): number
  cancel(handle: number): void
}

const rafScheduler: FrameScheduler = {
  request: (cb) => requestAnimationFrame(cb),
  cancel: (handle) => cancelAnimationFrame(handle),
}

/**
 * Sits between an adapter and the store.
 *
 * - Buffers ticks in a Map keyed by symbol (latest timestamp wins), so the
 *   buffer never holds more than one entry per subscribed symbol.
 * - Flushes the buffer into the store once per animation frame. In a
 *   background tab rAF pauses and the buffer simply stays bounded.
 * - Ref-counts subscriptions: many components on one symbol mean one
 *   subscription upstream. On every (re)connect it resubscribes to all of them.
 */
export class QuoteFeed {
  private adapter: Adapter | null = null
  private status: ConnectionStatus = 'idle'
  private readonly buffer = new Map<string, RawTick>()
  private readonly refCounts = new Map<string, number>()
  private readonly statusListeners = new Set<() => void>()
  private frame: number | null = null

  constructor(
    private readonly store: QuoteStore,
    private readonly scheduler: FrameScheduler = rafScheduler,
  ) {}

  /** Switch data source. Pass null to disconnect. Existing subscriptions carry over. */
  setAdapter(adapter: Adapter | null): void {
    if (this.adapter) this.adapter.close()
    this.dropPendingFrame()
    this.buffer.clear()
    this.store.clear()
    this.adapter = adapter
    if (!adapter) {
      this.setStatus('idle')
      return
    }
    adapter.connect({
      onTicks: (ticks) => {
        if (this.adapter === adapter) this.push(ticks)
      },
      onOpen: () => {
        if (this.adapter === adapter && this.refCounts.size > 0) {
          adapter.subscribe([...this.refCounts.keys()])
        }
      },
      onStatus: (status) => {
        if (this.adapter === adapter) this.setStatus(status)
      },
    })
  }

  /** Increment interest in a symbol; subscribes upstream on 0 → 1. */
  retain(symbol: string): void {
    const count = this.refCounts.get(symbol) ?? 0
    this.refCounts.set(symbol, count + 1)
    if (count === 0 && this.status === 'open') this.adapter?.subscribe([symbol])
  }

  /** Decrement interest; unsubscribes upstream on 1 → 0. */
  release(symbol: string): void {
    const count = this.refCounts.get(symbol)
    if (count === undefined) return
    if (count > 1) {
      this.refCounts.set(symbol, count - 1)
      return
    }
    this.refCounts.delete(symbol)
    this.buffer.delete(symbol)
    if (this.status === 'open') this.adapter?.unsubscribe([symbol])
  }

  getStatus = (): ConnectionStatus => this.status

  onStatus = (listener: () => void): (() => void) => {
    this.statusListeners.add(listener)
    return () => this.statusListeners.delete(listener)
  }

  /** Symbols with at least one subscriber. Exposed for debugging and tests. */
  subscribedSymbols(): string[] {
    return [...this.refCounts.keys()]
  }

  dispose(): void {
    this.setAdapter(null)
    this.statusListeners.clear()
  }

  private push(ticks: readonly RawTick[]): void {
    for (const tick of ticks) {
      // Sources may broadcast more than we asked for; ignore what nobody shows.
      if (!this.refCounts.has(tick.s)) continue
      const buffered = this.buffer.get(tick.s)
      if (buffered && tick.t < buffered.t) continue
      this.buffer.set(tick.s, tick)
    }
    if (this.buffer.size > 0 && this.frame === null) {
      this.frame = this.scheduler.request(this.flush)
    }
  }

  private readonly flush = (): void => {
    this.frame = null
    if (this.buffer.size === 0) return
    const batch = [...this.buffer.values()]
    this.buffer.clear()
    this.store.applyBatch(batch)
  }

  private dropPendingFrame(): void {
    if (this.frame !== null) this.scheduler.cancel(this.frame)
    this.frame = null
  }

  private setStatus(status: ConnectionStatus): void {
    if (status === this.status) return
    this.status = status
    for (const listener of this.statusListeners) listener()
  }
}
