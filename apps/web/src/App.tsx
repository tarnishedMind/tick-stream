import { useEffect, useState, useSyncExternalStore } from 'react'
import { QuoteRow } from './components/QuoteRow'
import { MockAdapter, QuoteFeed, QuoteStore, QuotesProvider, useFeedStatus, type Quotes } from './data'

/** Rows rendered by the debug view. The real table (M4) virtualizes all symbols. */
const MAX_ROWS = 100

function createQuotes(): Quotes & { mock: MockAdapter } {
  const store = new QuoteStore()
  return { store, feed: new QuoteFeed(store), mock: new MockAdapter() }
}

export function App() {
  const [quotes] = useState(createQuotes)

  useEffect(() => {
    quotes.feed.setAdapter(quotes.mock)
    return () => quotes.feed.setAdapter(null)
  }, [quotes])

  return (
    <QuotesProvider value={quotes}>
      <main style={{ fontFamily: 'system-ui, sans-serif', padding: 16 }}>
        <h1>TickStream</h1>
        <MockDebugView mock={quotes.mock} />
      </main>
    </QuotesProvider>
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
    </>
  )
}
