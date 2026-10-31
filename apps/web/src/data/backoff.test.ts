import { describe, expect, it } from 'vitest'
import { backoffDelay } from './backoff'

const opts = { baseMs: 100, maxMs: 1000 }

describe('backoffDelay', () => {
  it('grows exponentially up to the cap', () => {
    const max = () => 0.999999
    expect([0, 1, 2, 3, 4, 10].map((a) => backoffDelay(a, opts, max))).toEqual([99, 199, 399, 799, 999, 999])
  })

  it('applies full jitter in [0, cap)', () => {
    expect(backoffDelay(3, opts, () => 0)).toBe(0)
    expect(backoffDelay(3, opts, () => 0.5)).toBe(400)
  })
})
