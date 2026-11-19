import { QuoteFeed, QuoteStore, type Adapter } from '../data'
import { BinanceAdapter, MockAdapter } from '../data/adapters'
import type { Quotes } from '../data/react'
import type { SourceId } from './sources'

/** Everything the app wires together once: the store, the feed and one adapter per source. */
export type AppQuotes = Quotes & {
  mock: MockAdapter
  binance: BinanceAdapter
  adapters: Readonly<Record<SourceId, Adapter>>
}

/** Composition root of the data layer. */
export function createAppQuotes(): AppQuotes {
  const store = new QuoteStore()
  const mock = new MockAdapter()
  const binance = new BinanceAdapter()
  return { store, feed: new QuoteFeed(store), mock, binance, adapters: { mock, binance } }
}
