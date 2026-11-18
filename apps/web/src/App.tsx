import { useEffect, useState, useSyncExternalStore } from 'react'
import { QuoteRow } from './components/QuoteRow'
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

/** Rows rendered by the debug view. The real table (M4) virtualizes all symbols. */
const MAX_ROWS = 100

type Source = 'mock' | 'binance'

function createQuotes(): Quotes & { mock: MockAdapter; binance: BinanceAdapter } {
  const store = new QuoteStore()
  return { store, feed: new QuoteFeed(store), mock: new MockAdapter(), binance: new BinanceAdapter() }
}

export function App() {
  const [quotes] = useState(createQuotes)
  const [source, setSource] = useState<Source>('mock')

  useEffect(() => {
    quotes.feed.setAdapter(source === 'mock' ? quotes.mock : quotes.binance)
    return () => quotes.feed.setAdapter(null)
  }, [quotes, source])

  return (
    <QuotesProvider value={quotes}>
      <main style={{ fontFamily: 'system-ui, sans-serif', padding: 16 }}>
        <h1>TickStream</h1>
        <p>
          Source:{' '}
          {(['mock', 'binance'] as const).map((s) => (
            <label key={s} style={{ marginRight: 12 }}>
              <input type="radio" name="source" checked={source === s} onChange={() => setSource(s)} /> {s}
            </label>
          ))}
        </p>
        {source === 'mock' ? <MockDebugView mock={quotes.mock} /> : <BinanceDebugView />}
      </main>
    </QuotesProvider>
  )
}

/** Temporary screen for the Binance source. Replaced by the quotes table in M4. */
function BinanceDebugView() {
  const status = useFeedStatus()
  return (
    <>
      <span>
        Binance: <strong>{status}</strong>, {DEFAULT_BINANCE_SYMBOLS.length} symbols
      </span>
      <QuoteTable symbols={DEFAULT_BINANCE_SYMBOLS} />
    </>
  )
}

/** Temporary screen to exercise the mock source end to end. Replaced by the control panel in M4. */
function MockDebugView({ mock }: { mock: MockAdapter }) {
  const status = useFeedStatus()
  const config = useSyncExternalStore(mock.onConfig, mock.getConfig)
  const symbols = config?.symbols.slice(0, MAX_ROWS) ?? []

  return (
    <>
      <section style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <span>
          Mock server: <strong>{status}</strong>
        </span>
        {config && (
          <>
            <label>
              Ticks/sec: <strong>{config.tps.toLocaleString('en-US')}</strong>{' '}
              <input
                type="range"
                min={0}
                max={50_000}
                step={100}
                defaultValue={config.tps}
                onChange={(e) => mock.setLoad({ tps: Number(e.currentTarget.value) })}
              />
            </label>
            <label>
              Symbols:{' '}
              <input
                type="number"
                min={1}
                max={10_000}
                defaultValue={config.symbols.length}
                onBlur={(e) => mock.setLoad({ symbols: Number(e.currentTarget.value) })}
                style={{ width: 80 }}
              />
            </label>
            <span>
              Showing {symbols.length} of {config.symbols.length}
            </span>
          </>
        )}
      </section>
      <QuoteTable symbols={symbols} />
    </>
  )
}

function QuoteTable({ symbols }: { symbols: readonly string[] }) {
  return (
    <table style={{ marginTop: 16, borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
      <thead>
        <tr>
          <th align="left">Symbol</th>
          <th align="right">Price</th>
          <th align="right">Change</th>
          <th align="right">Time</th>
        </tr>
      </thead>
      <tbody>
        {symbols.map((s) => (
          <QuoteRow key={s} symbol={s} />
        ))}
      </tbody>
    </table>
  )
}
