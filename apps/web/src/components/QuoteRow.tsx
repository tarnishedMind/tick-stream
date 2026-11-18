import { Fragment, memo } from 'react'
import { flexRender, type Row } from '@tanstack/react-table'
import { useQuote } from '../data'
import { RowQuoteContext, type QuoteRowData, type quoteTableFeatures } from './quoteColumns'

export type QuoteTableRow = Row<typeof quoteTableFeatures, QuoteRowData>

/**
 * One table row bound to one symbol. Mounting subscribes the symbol upstream,
 * unmounting releases it, so only rows the virtualizer renders are subscribed.
 *
 * Memoized on the TanStack row object, which stays the same across parent
 * renders (scrolling, panel changes), so the row re-renders only when its own
 * quote changes.
 */
export const QuoteRow = memo(function QuoteRow({ row }: { row: QuoteTableRow }) {
  const quote = useQuote(row.original.symbol)
  return (
    <RowQuoteContext.Provider value={quote}>
      <tr>
        {row.getAllCells().map((cell) => (
          <Fragment key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</Fragment>
        ))}
      </tr>
    </RowQuoteContext.Provider>
  )
})
