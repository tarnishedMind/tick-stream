import type { WebSocket } from 'ws'
import type { Market } from './market'
import { TickPacer } from './market'

/** One connected client: its socket, the symbols it subscribed to and its own tick pacing. */
export class ClientSession {
  private symbols: string[] = []
  readonly pacer: TickPacer

  constructor(
    readonly socket: WebSocket,
    now: number,
  ) {
    this.pacer = new TickPacer(now)
  }

  get subscribed(): readonly string[] {
    return this.symbols
  }

  /** Add symbols the market knows; unknown ones are ignored. */
  subscribe(symbols: readonly string[], market: Market): void {
    const set = new Set(this.symbols)
    for (const s of symbols) if (market.has(s)) set.add(s)
    this.symbols = [...set]
  }

  unsubscribe(symbols: readonly string[]): void {
    const drop = new Set(symbols)
    this.symbols = this.symbols.filter((s) => !drop.has(s))
  }

  /** Drop subscriptions to symbols the market no longer simulates. */
  pruneTo(market: Market): void {
    this.symbols = this.symbols.filter((s) => market.has(s))
  }
}
