import { useEffect, useState } from 'react'
import { createAppQuotes, type AppQuotes } from './app/createAppQuotes'
import { SOURCES, type SourceId } from './app/sources'
import { useSourceControls } from './app/useSourceControls'
import { ControlPanel } from './components/controls/ControlPanel'
import { QuoteTable } from './components/quoteTable'
import { QuotesProvider, useFeedStatus } from './data/react'

export function App() {
  const [quotes] = useState(createAppQuotes)
  const [source, setSource] = useState<SourceId>('mock')

  // One adapter at a time: switching closes the previous socket before the next one opens.
  useEffect(() => {
    quotes.feed.setAdapter(quotes.adapters[source])
    return () => quotes.feed.setAdapter(null)
  }, [quotes, source])

  return (
    <QuotesProvider value={quotes}>
      <Screen quotes={quotes} source={source} onSourceChange={setSource} />
    </QuotesProvider>
  )
}

type ScreenProps = { quotes: AppQuotes; source: SourceId; onSourceChange(source: SourceId): void }

function Screen({ quotes, source, onSourceChange }: ScreenProps) {
  const status = useFeedStatus()
  const controls = useSourceControls(quotes, source)

  return (
    <main className="app">
      <header className="app-header">
        <h1>TickStream</h1>
      </header>
      <ControlPanel
        sources={SOURCES}
        source={source}
        onSourceChange={onSourceChange}
        status={status}
        controls={controls}
      />
      {/* Keyed by source: a switch resets scroll and remounts rows against the new symbol list. */}
      <QuoteTable key={source} symbols={controls.symbols} />
    </main>
  )
}
