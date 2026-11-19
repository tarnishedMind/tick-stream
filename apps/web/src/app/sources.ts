/** Data sources the user can switch between. Order is the order of the radio buttons. */
export const SOURCES = [
  { id: 'mock', label: 'Mock' },
  { id: 'binance', label: 'Binance' },
] as const

export type SourceId = (typeof SOURCES)[number]['id']
export type SourceInfo = (typeof SOURCES)[number]

/** What the control panel and the table need from the active source. */
export type SourceControls = {
  /** Symbols the table shows. */
  symbols: readonly string[]
  /** Upper bound for the symbol count input. */
  maxSymbols: number
  setSymbolCount(count: number): void
  /** Current ticks/sec; null when the source has no rate setting or has not reported it yet. */
  tps: number | null
  /** null when the source's rate cannot be changed. */
  setTps: ((tps: number) => void) | null
}
