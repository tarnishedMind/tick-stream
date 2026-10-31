import { describe, expect, it, vi } from 'vitest'
import { QuoteStore } from './QuoteStore'

describe('QuoteStore', () => {
  it('keeps price history needed by the UI', () => {
    const store = new QuoteStore()
    store.applyBatch([{ s: 'A', p: 10, t: 1 }])
    store.applyBatch([{ s: 'A', p: 12, t: 2 }])
    expect(store.get('A')).toEqual({ symbol: 'A', price: 12, prevPrice: 10, openPrice: 10, t: 2 })
  })

  it('drops ticks older than the stored one', () => {
    const store = new QuoteStore()
    store.applyBatch([{ s: 'A', p: 12, t: 5 }])
    const listener = vi.fn()
    store.listen('A', listener)
    store.applyBatch([{ s: 'A', p: 99, t: 4 }])
    expect(store.get('A')?.price).toBe(12)
    expect(listener).not.toHaveBeenCalled()
  })

  it('notifies only listeners of changed symbols, once per batch', () => {
    const store = new QuoteStore()
    const a = vi.fn()
    const b = vi.fn()
    store.listen('A', a)
    store.listen('B', b)
    store.applyBatch([{ s: 'A', p: 1, t: 1 }])
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).not.toHaveBeenCalled()
  })

  it('returns a stable snapshot until the symbol changes', () => {
    const store = new QuoteStore()
    store.applyBatch([{ s: 'A', p: 1, t: 1 }])
    const first = store.get('A')
    store.applyBatch([{ s: 'B', p: 1, t: 1 }])
    expect(store.get('A')).toBe(first)
  })

  it('notifies listeners only after the whole batch is applied', () => {
    const store = new QuoteStore()
    const seen: Array<number | undefined> = []
    store.listen('A', () => seen.push(store.get('B')?.price))
    store.applyBatch([
      { s: 'A', p: 1, t: 1 },
      { s: 'B', p: 2, t: 1 },
    ])
    expect(seen).toEqual([2])
  })

  it('stops notifying after unlisten', () => {
    const store = new QuoteStore()
    const listener = vi.fn()
    const unlisten = store.listen('A', listener)
    unlisten()
    store.applyBatch([{ s: 'A', p: 1, t: 1 }])
    expect(listener).not.toHaveBeenCalled()
  })
})
