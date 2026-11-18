import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { ControlPanel, type Source } from './components/ControlPanel'
import { QuoteTable } from './components/QuoteTable'
import {
  BinanceAdapter,
  DEFAULT_BINANCE_SYMBOLS,
  MockAdapter,
  QuoteFeed,
  QuoteStore,
  QuotesProvider,
  useFeedStatus,
  type Quotes,
} from './data'

/** Same bound as the mock server (apps/mock-server/src/protocol.ts LIMITS). */
const MAX_MOCK_SYMBOLS = 10_000
const NO_SYMBOLS: readonly string[] = []

type AppQuotes = Quotes & { mock: MockAdapter; binance: BinanceAdapter }

function createQuotes(): AppQuotes {
  const store = new QuoteStore()
  return { store, feed: new QuoteFeed(store), mock: new MockAdapter(), binance: new BinanceAdapter() }
}

export function App() {
  const [quotes] = useState(createQuotes)
  const [source, setSource] = useState<Source>('mock')

  // One adapter at a time: switching closes the previous socket before the next one opens.
  useEffect(() => {
    quotes.feed.setAdapter(source === 'mock' ? quotes.mock : quotes.binance)
    return () => quotes.feed.setAdapter(null)
  }, [quotes, source])

  return (
    <QuotesProvider value={quotes}>
      <Screen quotes={quotes} source={source} onSourceChange={setSource} />
    </QuotesProvider>
  )
}

function Screen({ quotes, source, onSourceChange }: { quotes: AppQuotes; source: Source; onSourceChange(s: Source): void }) {
  const status = useFeedStatus()
  const mockConfig = useSyncExternalStore(quotes.mock.onConfig, quotes.mock.getConfig)
  const mockSymbols = useStableArray(mockConfig?.symbols ?? NO_SYMBOLS)

  const [binanceCount, setBinanceCount] = useState(DEFAULT_BINANCE_SYMBOLS.length)
  const binanceSymbols = useMemo(() => DEFAULT_BINANCE_SYMBOLS.slice(0, binanceCount), [binanceCount])

  const isMock = source === 'mock'
  const symbols = isMock ? mockSymbols : binanceSymbols

  return (
    <main className="app">
      <header className="app-header">
        <h1>TickStream</h1>
      </header>
      <ControlPanel
        source={source}
        onSourceChange={onSourceChange}
        status={status}
        tps={isMock ? (mockConfig?.tps ?? null) : null}
        onTpsChange={(tps) => quotes.mock.setLoad({ tps })}
        symbolCount={symbols.length}
        maxSymbols={isMock ? MAX_MOCK_SYMBOLS : DEFAULT_BINANCE_SYMBOLS.length}
        onSymbolCountChange={(n) => (isMock ? quotes.mock.setLoad({ symbols: n }) : setBinanceCount(n))}
      />
      {/* Keyed by source: a switch resets scroll and remounts rows against the new symbol list. */}
      <QuoteTable key={source} symbols={symbols} />
    </main>
  )
}

/**
 * The mock server re-sends its full symbol list with every config change
 * (e.g. each slider step). Keep the previous array when the contents match,
 * so the table does not rebuild its rows and re-render every visible row.
 */
function useStableArray(next: readonly string[]): readonly string[] {
  const ref = useRef(next)
  const prev = ref.current
  if (prev !== next && (prev.length !== next.length || prev.some((s, i) => s !== next[i]))) ref.current = next
  return ref.current
}
