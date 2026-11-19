import { useEffect, useRef } from 'react'
import { formatChangePercent, formatPrice, formatTime, PLACEHOLDER } from '../../format'
import { useRowQuote } from './rowQuote'

const FLASH_MS = 400

/**
 * Flash colors come from `--flash-up` / `--flash-down` in styles.css. Read once,
 * on the first flash, instead of a style lookup per tick.
 */
let flashColors: { up: string; down: string } | null = null
function getFlashColors(): { up: string; down: string } {
  if (!flashColors) {
    const style = getComputedStyle(document.documentElement)
    flashColors = {
      up: style.getPropertyValue('--flash-up').trim(),
      down: style.getPropertyValue('--flash-down').trim(),
    }
  }
  return flashColors
}

export function SymbolCell({ symbol }: { symbol: string }) {
  return <td className="col-symbol">{symbol}</td>
}

/** Last price. Flashes green/red on change via the Web Animations API, outside React state. */
export function PriceCell() {
  const quote = useRowQuote()
  const ref = useRef<HTMLTableCellElement>(null)
  const flash = useRef<Animation | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !quote || quote.price === quote.prevPrice) return
    const { up, down } = getFlashColors()
    // A hot symbol changes every frame: restart the flash instead of stacking animations.
    flash.current?.cancel()
    flash.current = el.animate(
      [{ backgroundColor: quote.price > quote.prevPrice ? up : down }, { backgroundColor: 'transparent' }],
      { duration: FLASH_MS, easing: 'ease-out' },
    )
  }, [quote])

  return (
    <td ref={ref} className="num">
      {quote ? formatPrice(quote.price) : PLACEHOLDER}
    </td>
  )
}

/** Change vs the first price seen for this symbol in the current session. */
export function ChangeCell() {
  const quote = useRowQuote()
  if (!quote) return <td className="num">{PLACEHOLDER}</td>
  const change = ((quote.price - quote.openPrice) / quote.openPrice) * 100
  const tone = change > 0 ? 'up' : change < 0 ? 'down' : ''
  return <td className={`num ${tone}`}>{formatChangePercent(change)}</td>
}

export function TimeCell() {
  const quote = useRowQuote()
  return <td className="num muted">{quote ? formatTime(quote.t) : PLACEHOLDER}</td>
}
