import { createContext, useContext } from 'react'
import type { Quote } from '../../data'

/**
 * The quote of the row being rendered. `QuoteRow` subscribes once per row and
 * provides it here, so cell renderers stay plain components.
 */
export const RowQuoteContext = createContext<Quote | undefined>(undefined)

/** Quote of the enclosing row; undefined until its first tick. */
export function useRowQuote(): Quote | undefined {
  return useContext(RowQuoteContext)
}
