import type { RawTick } from '../types'
import { WsAdapter, type WsAdapterOptions } from '../WsAdapter'
import {
  BINANCE_LIMITS,
  BINANCE_WS_URL,
  aggTradeStream,
  type BinanceAggTrade,
  type BinanceMethod,
  type BinanceRequest,
  type BinanceResponse,
} from './binanceProtocol'

export type BinanceAdapterOptions = WsAdapterOptions & {
  url?: string
  /**
   * Control frames we send per second. Binance drops connections above 5
   * incoming messages/sec, and the browser's automatic pongs count too, so the
   * default stays well below.
   */
  controlFramesPerSecond?: number
  /** Streams per connection; extra symbols are not subscribed. */
  maxStreams?: number
  /** Streams per SUBSCRIBE / UNSUBSCRIBE frame. */
  maxParamsPerFrame?: number
  /**
   * Reconnect if no message arrives for this long while subscribed. Catches
   * half-open connections the browser does not report. 0 disables it.
   */
  staleAfterMs?: number
  now?: () => number
}

const DEFAULTS = {
  controlFramesPerSecond: 3,
  maxStreams: BINANCE_LIMITS.maxStreamsPerConnection,
  maxParamsPerFrame: 200,
  staleAfterMs: 30_000,
}

/**
 * Live trades from Binance spot: one `<symbol>@aggTrade` stream per symbol on a
 * single socket, managed with SUBSCRIBE / UNSUBSCRIBE frames.
 *
 * Subscription changes are coalesced into a desired set and sent through a
 * rate-limited queue: each frame carries the current difference between what
 * the app wants and what the server has, so a burst of row mounts becomes one
 * frame and a subscribe followed by an unsubscribe sends nothing. The 24h
 * forced disconnect is an ordinary close and goes through WsAdapter's reconnect.
 */
export class BinanceAdapter extends WsAdapter {
  readonly name = 'binance'

  private readonly endpoint: string
  private readonly frameIntervalMs: number
  private readonly maxStreams: number
  private readonly maxParamsPerFrame: number
  private readonly staleAfterMs: number
  private readonly now: () => number

  /** Symbols the feed wants. */
  private readonly desired = new Set<string>()
  /** Symbols already requested from the server on this connection. */
  private readonly active = new Set<string>()
  /** Requests waiting for a reply, by id. */
  private readonly inFlight = new Map<number, BinanceRequest>()
  private nextId = 1
  private lastFrameAt = Number.NEGATIVE_INFINITY
  private lastMessageAt = 0
  private frameTimer: ReturnType<typeof setTimeout> | null = null
  private staleTimer: ReturnType<typeof setInterval> | null = null
  private warnedOverLimit = false

  constructor(options: BinanceAdapterOptions = {}) {
    super(options)
    this.endpoint = options.url ?? BINANCE_WS_URL
    this.frameIntervalMs = Math.ceil(1000 / (options.controlFramesPerSecond ?? DEFAULTS.controlFramesPerSecond))
    this.maxStreams = options.maxStreams ?? DEFAULTS.maxStreams
    this.maxParamsPerFrame = options.maxParamsPerFrame ?? DEFAULTS.maxParamsPerFrame
    this.staleAfterMs = options.staleAfterMs ?? DEFAULTS.staleAfterMs
    this.now = options.now ?? Date.now
  }

  override subscribe(symbols: readonly string[]): void {
    for (const symbol of symbols) this.desired.add(symbol)
    this.scheduleFrame()
  }

  override unsubscribe(symbols: readonly string[]): void {
    for (const symbol of symbols) this.desired.delete(symbol)
    this.scheduleFrame()
  }

  /** Symbols currently requested from the server. Exposed for debugging and tests. */
  activeSymbols(): string[] {
    return [...this.active]
  }

  protected url(): string {
    return this.endpoint
  }

  protected parse(data: unknown): RawTick[] {
    this.lastMessageAt = this.now()
    if (typeof data !== 'string') return []
    let msg: unknown
    try {
      msg = JSON.parse(data)
    } catch {
      return []
    }
    if (typeof msg !== 'object' || msg === null) return []
    // Combined-stream endpoints wrap payloads as `{ stream, data }`.
    const payload = 'data' in msg && 'stream' in msg ? (msg as { data: unknown }).data : msg
    const tick = toRawTick(payload)
    if (tick) return [tick]
    if ('id' in msg) this.handleResponse(msg as BinanceResponse)
    return []
  }

  protected subscribeMessage(symbols: readonly string[]): string {
    return this.request('SUBSCRIBE', symbols)
  }

  protected unsubscribeMessage(symbols: readonly string[]): string {
    return this.request('UNSUBSCRIBE', symbols)
  }

  protected override onSocketOpen(): void {
    // A new connection starts with no streams; the feed resubscribes right after this.
    this.resetConnectionState()
    this.lastMessageAt = this.now()
    if (this.staleAfterMs > 0) {
      this.staleTimer = setInterval(this.checkStale, Math.max(1, Math.floor(this.staleAfterMs / 3)))
    }
  }

  protected override onSocketClose(): void {
    this.resetConnectionState()
  }

  private resetConnectionState(): void {
    if (this.frameTimer !== null) clearTimeout(this.frameTimer)
    if (this.staleTimer !== null) clearInterval(this.staleTimer)
    this.frameTimer = null
    this.staleTimer = null
    this.desired.clear()
    this.active.clear()
    this.inFlight.clear()
    this.lastFrameAt = Number.NEGATIVE_INFINITY
  }

  private request(method: BinanceMethod, symbols: readonly string[]): string {
    const req: BinanceRequest = { method, params: symbols.map(aggTradeStream), id: this.nextId++ }
    this.inFlight.set(req.id, req)
    return JSON.stringify(req)
  }

  /** Send the next frame when the rate limit allows; at most one timer is pending. */
  private scheduleFrame(): void {
    if (this.frameTimer !== null || !this.isOpen()) return
    const wait = Math.max(0, this.lastFrameAt + this.frameIntervalMs - this.now())
    // Even with no wait, defer to the next task so a burst of calls becomes one frame.
    this.frameTimer = setTimeout(this.sendNextFrame, wait)
  }

  private readonly sendNextFrame = (): void => {
    this.frameTimer = null
    const frame = this.nextFrame()
    if (frame === null) return
    this.send(frame)
    this.lastFrameAt = this.now()
    this.lastMessageAt = this.lastFrameAt
    this.scheduleFrame()
  }

  /** Unsubscribes go first, so freed slots are available to the following subscribe. */
  private nextFrame(): string | null {
    const toRemove: string[] = []
    for (const symbol of this.active) {
      if (!this.desired.has(symbol)) toRemove.push(symbol)
      if (toRemove.length === this.maxParamsPerFrame) break
    }
    if (toRemove.length > 0) {
      for (const symbol of toRemove) this.active.delete(symbol)
      return this.unsubscribeMessage(toRemove)
    }

    const room = Math.min(this.maxStreams - this.active.size, this.maxParamsPerFrame)
    const toAdd: string[] = []
    let missing = 0
    for (const symbol of this.desired) {
      if (this.active.has(symbol)) continue
      missing += 1
      if (toAdd.length < room) toAdd.push(symbol)
    }
    if (this.active.size + missing > this.maxStreams && !this.warnedOverLimit) {
      this.warnedOverLimit = true
      console.warn(
        `[binance] ${this.active.size + missing} symbols requested, but one connection allows ${this.maxStreams} streams; the rest are not subscribed`,
      )
    }
    if (toAdd.length === 0) return null
    for (const symbol of toAdd) this.active.add(symbol)
    return this.subscribeMessage(toAdd)
  }

  private handleResponse(res: BinanceResponse): void {
    const req = typeof res.id === 'number' ? this.inFlight.get(res.id) : undefined
    if (typeof res.id === 'number') this.inFlight.delete(res.id)
    const error = res.error ?? (res.code !== undefined ? { code: res.code, msg: res.msg ?? '' } : undefined)
    if (!error) return
    console.warn(`[binance] request ${res.id} failed: ${error.code} ${error.msg}`, req)
    // The server did not take these streams; forget them so a later change retries.
    if (req?.method === 'SUBSCRIBE') {
      for (const stream of req.params) {
        for (const symbol of this.active) if (aggTradeStream(symbol) === stream) this.active.delete(symbol)
      }
    }
  }

  private readonly checkStale = (): void => {
    if (this.active.size === 0) return
    if (this.now() - this.lastMessageAt < this.staleAfterMs) return
    console.warn(`[binance] no data for ${this.staleAfterMs} ms, reconnecting`)
    this.reconnect()
  }
}

/** Map one aggTrade payload to a RawTick; anything else gives null. */
export function toRawTick(payload: unknown): RawTick | null {
  if (typeof payload !== 'object' || payload === null) return null
  const m = payload as Partial<BinanceAggTrade>
  if (m.e !== 'aggTrade' || typeof m.s !== 'string' || typeof m.T !== 'number') return null
  const price = Number(m.p)
  if (typeof m.p !== 'string' || !Number.isFinite(price)) return null
  return { s: m.s, p: price, t: m.T }
}
