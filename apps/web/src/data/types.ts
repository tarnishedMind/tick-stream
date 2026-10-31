/** Normalized tick every adapter produces: symbol, price, exchange timestamp (ms). */
export type RawTick = { s: string; p: number; t: number }

/** Latest known state of one symbol, as kept by the store. Treated as immutable. */
export type Quote = {
  symbol: string
  price: number
  /** Price before the latest update; equals `price` for the first tick. */
  prevPrice: number
  /** First price seen in this session, used as the reference for change %. */
  openPrice: number
  /** Timestamp of the latest applied tick (ms). */
  t: number
}

export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed'

/** Callbacks the feed passes to an adapter. */
export type AdapterHandlers = {
  onTicks(ticks: readonly RawTick[]): void
  /** Called on every successful (re)connect. The feed resubscribes here. */
  onOpen(): void
  onStatus(status: ConnectionStatus): void
}

/**
 * A data source. Adapters hide exchange-specific formats and protocols;
 * nothing outside an adapter knows where ticks come from.
 */
export interface Adapter {
  readonly name: string
  connect(handlers: AdapterHandlers): void
  /** Only called while connected. Symbols are in the app's format. */
  subscribe(symbols: readonly string[]): void
  unsubscribe(symbols: readonly string[]): void
  close(): void
}
