import { createContext, useContext, useEffect, useRef } from 'react'
import { columnSizingFeature, createColumnHelper, tableFeatures } from '@tanstack/react-table'
import type { Quote } from '../data'

/** Row data handed to TanStack Table. Prices never go through it: rows read them via `useQuote`. */
export type QuoteRowData = { symbol: string }

export const quoteTableFeatures = tableFeatures({ columnSizingFeature })

/**
 * The quote of the row being rendered. `QuoteRow` subscribes once per row and
 * provides it here, so cell renderers stay plain components.
 */
export const RowQuoteContext = createContext<Quote | undefined>(undefined)

const FLASH_MS = 400
const UP = 'rgba(22, 163, 74, 0.35)'
const DOWN = 'rgba(220, 38, 38, 0.35)'

const priceFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
const timeFormat = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3,
})

function SymbolCell({ symbol }: { symbol: string }) {
  return <td className="col-symbol">{symbol}</td>
}

/** Last price. Flashes green/red on change via the Web Animations API, outside React state. */
function PriceCell() {
  const quote = useContext(RowQuoteContext)
  const ref = useRef<HTMLTableCellElement>(null)
  const flash = useRef<Animation | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !quote || quote.price === quote.prevPrice) return
    // A hot symbol changes every frame: restart the flash instead of stacking animations.
    flash.current?.cancel()
    flash.current = el.animate(
      [{ backgroundColor: quote.price > quote.prevPrice ? UP : DOWN }, { backgroundColor: 'transparent' }],
      { duration: FLASH_MS, easing: 'ease-out' },
    )
  }, [quote])

  return (
    <td ref={ref} className="num">
      {quote ? priceFormat.format(quote.price) : '—'}
    </td>
  )
}

/** Change vs the first price seen for this symbol in the current session. */
function ChangeCell() {
  const quote = useContext(RowQuoteContext)
  if (!quote) return <td className="num">—</td>
  const change = ((quote.price - quote.openPrice) / quote.openPrice) * 100
  const tone = change > 0 ? 'up' : change < 0 ? 'down' : ''
  return (
    <td className={`num ${tone}`}>
      {change > 0 ? '+' : ''}
      {change.toFixed(2)}%
    </td>
  )
}

function TimeCell() {
  const quote = useContext(RowQuoteContext)
  return <td className="num muted">{quote ? timeFormat.format(quote.t) : '—'}</td>
}

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
  helper.display({ id: 'price', header: 'Last', size: 160, cell: () => <PriceCell /> }),
  helper.display({ id: 'change', header: 'Change', size: 110, cell: () => <ChangeCell /> }),
  helper.display({ id: 'time', header: 'Last update', size: 140, cell: () => <TimeCell /> }),
])
