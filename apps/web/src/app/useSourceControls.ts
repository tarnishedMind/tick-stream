import { LIMITS } from '@tick-stream/protocol'
import { useMemo, useState } from 'react'
import { DEFAULT_BINANCE_SYMBOLS, type MockAdapter } from '../data/adapters'
import { useMockConfig } from '../data/react'
import type { AppQuotes } from './createAppQuotes'
import type { SourceControls, SourceId } from './sources'

const NO_SYMBOLS: readonly string[] = []

/**
 * Controls for the active source. Every source's hook runs on every render
 * (hooks can't be conditional), so each source keeps its own state across
 * switches, e.g. the Binance symbol count.
 */
export function useSourceControls(quotes: AppQuotes, source: SourceId): SourceControls {
  const controls: Record<SourceId, SourceControls> = {
    mock: useMockControls(quotes.mock),
    binance: useBinanceControls(),
  }
  return controls[source]
}

/** Rate and symbol count live on the mock server; changes go over the socket and come back as config. */
function useMockControls(mock: MockAdapter): SourceControls {
  const config = useMockConfig(mock)
  return {
    symbols: config?.symbols ?? NO_SYMBOLS,
    maxSymbols: LIMITS.symbols.max,
    setSymbolCount: (symbols) => mock.setLoad({ symbols }),
    tps: config?.tps ?? null,
    setTps: (tps) => mock.setLoad({ tps }),
  }
}

/** Binance streams at its own pace; the count picks the first N default symbols. */
function useBinanceControls(): SourceControls {
  const [count, setCount] = useState(DEFAULT_BINANCE_SYMBOLS.length)
  const symbols = useMemo(() => DEFAULT_BINANCE_SYMBOLS.slice(0, count), [count])
  return { symbols, maxSymbols: DEFAULT_BINANCE_SYMBOLS.length, setSymbolCount: setCount, tps: null, setTps: null }
}
