import { memo, useEffect, useRef } from 'react'
import { useQuote } from '../data'

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

/**
 * One table row bound to one symbol. Re-renders only when its own quote
 * changes. The price flash runs on the Web Animations API, so it never goes
 * through React state.
 */
export const QuoteRow = memo(function QuoteRow({ symbol }: { symbol: string }) {
  const quote = useQuote(symbol)
  const priceRef = useRef<HTMLTableCellElement>(null)

  useEffect(() => {
    const el = priceRef.current
    if (!el || !quote || quote.price === quote.prevPrice) return
    el.animate([{ backgroundColor: quote.price > quote.prevPrice ? UP : DOWN }, { backgroundColor: 'transparent' }], {
      duration: FLASH_MS,
      easing: 'ease-out',
    })
  }, [quote])

  if (!quote) {
    return (
      <tr>
        <td>{symbol}</td>
        <td>—</td>
        <td>—</td>
        <td>—</td>
      </tr>
    )
  }

  const change = ((quote.price - quote.openPrice) / quote.openPrice) * 100
  return (
    <tr>
      <td>{symbol}</td>
      <td ref={priceRef}>{priceFormat.format(quote.price)}</td>
      <td style={{ color: change > 0 ? 'green' : change < 0 ? 'crimson' : undefined }}>
        {change > 0 ? '+' : ''}
        {change.toFixed(2)}%
      </td>
      <td>{timeFormat.format(quote.t)}</td>
    </tr>
  )
})
