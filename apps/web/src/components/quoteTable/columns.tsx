import { columnSizingFeature, createColumnHelper, tableFeatures } from '@tanstack/react-table'
import { ChangeCell, PriceCell, SymbolCell, TimeCell } from './cells'

/** Row data handed to TanStack Table. Prices never go through it: rows read them via `useQuote`. */
export type QuoteRowData = { symbol: string }

/** Per-column settings the table reads from `columnDef.meta`. */
export type QuoteColumnMeta = { align?: 'left' | 'right' }

export const quoteTableFeatures = tableFeatures({
  columnSizingFeature,
  columnMeta: {} as QuoteColumnMeta,
})

const helper = createColumnHelper<typeof quoteTableFeatures, QuoteRowData>()

/**
 * Column definitions. Each cell renderer returns its own `<td>`, so the price
 * cell can own the element it flashes. Module scope keeps them stable.
 */
export const quoteColumns = helper.columns([
  helper.accessor('symbol', {
    header: 'Symbol',
    size: 160,
    cell: (ctx) => <SymbolCell symbol={ctx.getValue()} />,
  }),
  helper.display({ id: 'price', header: 'Last', size: 160, meta: { align: 'right' }, cell: () => <PriceCell /> }),
  helper.display({ id: 'change', header: 'Change', size: 110, meta: { align: 'right' }, cell: () => <ChangeCell /> }),
  helper.display({ id: 'time', header: 'Last update', size: 140, meta: { align: 'right' }, cell: () => <TimeCell /> }),
])
