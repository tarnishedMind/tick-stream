import { describe, expect, it } from 'vitest'
import { formatChangePercent, formatInteger, formatPrice, formatTime } from './format'

describe('format', () => {
  it('formats integers like toLocaleString("en-US")', () => {
    expect(formatInteger(100_000)).toBe((100_000).toLocaleString('en-US'))
    expect(formatInteger(0)).toBe('0')
  })

  it('formats prices with 2 to 6 decimals', () => {
    expect(formatPrice(67012.34)).toBe('67,012.34')
    expect(formatPrice(0.00001234)).toBe('0.000012')
  })

  it('formats signed change percentages', () => {
    expect(formatChangePercent(1.254)).toBe('+1.25%')
    expect(formatChangePercent(-0.4)).toBe('-0.40%')
    expect(formatChangePercent(0)).toBe('0.00%')
  })

  it('formats time of day with milliseconds', () => {
    expect(formatTime(new Date(2026, 0, 1, 14, 3, 7, 215).getTime())).toBe('14:03:07.215')
  })
})
