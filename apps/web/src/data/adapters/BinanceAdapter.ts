import { parseJson } from '@tick-stream/protocol'
import { StaleWatchdog } from '../StaleWatchdog'
import { SubscriptionPlanner } from '../SubscriptionPlanner'
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
  private readonly staleAfterMs: number
  private readonly now: () => number

  /** Desired vs requested streams, turned into frames within Binance's limits. */
  private readonly planner: SubscriptionPlanner
  private readonly watchdog: StaleWatchdog
  /** Requests waiting for a reply, by id, with the symbols they carry. */
  private readonly inFlight = new Map<number, { req: BinanceRequest; symbols: readonly string[] }>()
  private nextId = 1
  private lastFrameAt = Number.NEGATIVE_INFINITY
  private frameTimer: ReturnType<typeof setTimeout> | null = null

  constructor(options: BinanceAdapterOptions = {}) {
    super(options)
    this.endpoint = options.url ?? BINANCE_WS_URL
    this.frameIntervalMs = Math.ceil(1000 / (options.controlFramesPerSecond ?? DEFAULTS.controlFramesPerSecond))
    this.staleAfterMs = options.staleAfterMs ?? DEFAULTS.staleAfterMs
    this.now = options.now ?? Date.now
    this.planner = new SubscriptionPlanner(
      {
        maxStreams: options.maxStreams ?? DEFAULTS.maxStreams,
        maxPerChange: options.maxParamsPerFrame ?? DEFAULTS.maxParamsPerFrame,
      },
      (requested, maxStreams) =>
        console.warn(
          `[binance] ${requested} symbols requested, but one connection allows ${maxStreams} streams; the rest are not subscribed`,
        ),
    )
    this.watchdog = new StaleWatchdog({
      timeoutMs: this.staleAfterMs,
      now: this.now,
      isWatching: () => this.planner.activeCount > 0,
      onStale: () => {
        console.warn(`[binance] no data for ${this.staleAfterMs} ms, reconnecting`)
        this.reconnect()
      },
    })
  }

  override subscribe(symbols: readonly string[]): void {
    this.planner.want(symbols)
    this.scheduleFrame()
  }

  override unsubscribe(symbols: readonly string[]): void {
    this.planner.unwant(symbols)
    this.scheduleFrame()
  }

  /** Symbols currently requested from the server. Exposed for debugging and tests. */
  activeSymbols(): string[] {
    return this.planner.activeSymbols()
  }

  protected url(): string {
    return this.endpoint
  }

  protected parse(data: unknown): RawTick[] {
    this.watchdog.touch()
    const msg = parseJson(data)
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
    this.watchdog.start()
  }

  protected override onSocketClose(): void {
    this.resetConnectionState()
  }

  private resetConnectionState(): void {
    if (this.frameTimer !== null) clearTimeout(this.frameTimer)
    this.frameTimer = null
    this.watchdog.stop()
    this.planner.reset()
    this.inFlight.clear()
    this.lastFrameAt = Number.NEGATIVE_INFINITY
  }

  private request(method: BinanceMethod, symbols: readonly string[]): string {
    const req: BinanceRequest = { method, params: symbols.map(aggTradeStream), id: this.nextId++ }
    this.inFlight.set(req.id, { req, symbols })
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
    const change = this.planner.next()
    if (change === null) return
    this.send(
      change.op === 'subscribe' ? this.subscribeMessage(change.symbols) : this.unsubscribeMessage(change.symbols),
    )
    this.lastFrameAt = this.now()
    this.watchdog.touch()
    this.scheduleFrame()
  }

  private handleResponse(res: BinanceResponse): void {
    const pending = typeof res.id === 'number' ? this.inFlight.get(res.id) : undefined
    if (typeof res.id === 'number') this.inFlight.delete(res.id)
    const error = res.error ?? (res.code !== undefined ? { code: res.code, msg: res.msg ?? '' } : undefined)
    if (!error) return
    console.warn(`[binance] request ${res.id} failed: ${error.code} ${error.msg}`, pending?.req)
    if (pending?.req.method === 'SUBSCRIBE') this.planner.rejected(pending.symbols)
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
