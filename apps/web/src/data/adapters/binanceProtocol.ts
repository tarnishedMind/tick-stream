/**
 * The subset of the Binance Spot WebSocket Streams protocol the adapter uses.
 * https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams
 */

/** Market-data-only endpoint (no account streams). Raw streams live under `/ws`. */
export const BINANCE_WS_URL = 'wss://data-stream.binance.vision/ws'

/** Documented per-connection limits. */
export const BINANCE_LIMITS = {
  /** Incoming messages per second the server accepts (control frames, pings, pongs). More gets the connection dropped. */
  maxIncomingMessagesPerSecond: 5,
  /** Streams one connection may be subscribed to. */
  maxStreamsPerConnection: 1024,
  /** The server closes every connection after 24 hours. */
  maxConnectionAgeMs: 24 * 60 * 60 * 1000,
} as const

export type BinanceMethod = 'SUBSCRIBE' | 'UNSUBSCRIBE'

/** Client → server control frame. */
export type BinanceRequest = { method: BinanceMethod; params: string[]; id: number }

/** Server → client reply to a control frame: `{ result: null, id }` on success. */
export type BinanceResponse = {
  id: number | string | null
  result?: unknown
  /** Error replies carry `code` and `msg`, either at the top level or under `error`. */
  code?: number
  msg?: string
  error?: { code: number; msg: string }
}

/** `<symbol>@aggTrade` payload. Prices and quantities are decimal strings. */
export type BinanceAggTrade = {
  e: 'aggTrade'
  /** Event time (ms). */
  E: number
  /** Symbol, upper case, e.g. "BTCUSDT". */
  s: string
  /** Aggregate trade id. */
  a: number
  /** Price. */
  p: string
  /** Quantity. */
  q: string
  /** First and last trade id. */
  f: number
  l: number
  /** Trade time (ms). */
  T: number
  /** Is the buyer the market maker? */
  m: boolean
}

/** Stream name for a symbol in the app's (upper case Binance) format. */
export function aggTradeStream(symbol: string): string {
  return `${symbol.toLowerCase()}@aggTrade`
}
