import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from 'react'
import type { QuoteFeed } from './QuoteFeed'
import type { QuoteStore } from './QuoteStore'
import type { ConnectionStatus, Quote } from './types'

export type Quotes = { store: QuoteStore; feed: QuoteFeed }

const QuotesContext = createContext<Quotes | null>(null)

export function QuotesProvider({ value, children }: { value: Quotes; children: ReactNode }) {
  return <QuotesContext.Provider value={value}>{children}</QuotesContext.Provider>
}

function useQuotes(): Quotes {
  const quotes = useContext(QuotesContext)
  if (!quotes) throw new Error('useQuote must be used inside <QuotesProvider>')
  return quotes
}

/**
 * Latest quote for one symbol. The component re-renders only when this symbol
 * changes. Mounting subscribes the symbol upstream, unmounting releases it.
 */
export function useQuote(symbol: string): Quote | undefined {
  const { store, feed } = useQuotes()
  const subscribe = useCallback(
    (onChange: () => void) => {
      const unlisten = store.listen(symbol, onChange)
      feed.retain(symbol)
      return () => {
        unlisten()
        feed.release(symbol)
      }
    },
    [store, feed, symbol],
  )
  const getSnapshot = useCallback(() => store.get(symbol), [store, symbol])
  return useSyncExternalStore(subscribe, getSnapshot)
}

export function useFeedStatus(): ConnectionStatus {
  const { feed } = useQuotes()
  return useSyncExternalStore(feed.onStatus, feed.getStatus)
}
