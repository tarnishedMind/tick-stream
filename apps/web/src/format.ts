/** Display formatting shared by the table and the control panel. All output is en-US. */

/** Shown wherever a value is not known yet. */
export const PLACEHOLDER = '—'

const integerFormat = new Intl.NumberFormat('en-US')
const priceFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
const timeFormat = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3,
})

/** Grouped integer, e.g. 10,000. */
export function formatInteger(value: number): string {
  return integerFormat.format(value)
}

/** Price with 2 to 6 decimals. */
export function formatPrice(value: number): string {
  return priceFormat.format(value)
}

/** Time of day with milliseconds, e.g. 14:03:07.215. */
export function formatTime(ms: number): string {
  return timeFormat.format(ms)
}

/** Signed percentage with 2 decimals, e.g. +1.25% or -0.40%. */
export function formatChangePercent(change: number): string {
  return `${change > 0 ? '+' : ''}${change.toFixed(2)}%`
}
