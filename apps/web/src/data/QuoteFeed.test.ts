import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QuoteFeed } from './QuoteFeed'
import { QuoteStore } from './QuoteStore'
import { FakeAdapter, ManualFrames } from './testing'

let store: QuoteStore
let frames: ManualFrames
let feed: QuoteFeed
let adapter: FakeAdapter

beforeEach(() => {
  store = new QuoteStore()
  frames = new ManualFrames()
  feed = new QuoteFeed(store, frames)
  adapter = new FakeAdapter()
})

function connected(...symbols: string[]) {
  for (const s of symbols) feed.retain(s)
  feed.setAdapter(adapter)
  adapter.open()
}

describe('QuoteFeed buffering', () => {
  it('flushes once per frame with the latest tick per symbol', () => {
    connected('A', 'B')
    const applySpy = vi.spyOn(store, 'applyBatch')
    adapter.emit({ s: 'A', p: 1, t: 1 }, { s: 'A', p: 2, t: 2 })
    adapter.emit({ s: 'B', p: 5, t: 1 }, { s: 'A', p: 3, t: 3 })

    expect(frames.size).toBe(1)
    expect(store.get('A')).toBeUndefined()

    frames.runFrame()
    expect(applySpy).toHaveBeenCalledTimes(1)
    expect(store.get('A')?.price).toBe(3)
    expect(store.get('B')?.price).toBe(5)
  })

  it('drops out-of-order ticks inside the buffer', () => {
    connected('A')
    adapter.emit({ s: 'A', p: 2, t: 10 }, { s: 'A', p: 1, t: 9 })
    frames.runFrame()
    expect(store.get('A')?.price).toBe(2)
  })

  it('does not schedule a frame when nothing is buffered', () => {
    connected('A')
    adapter.emit({ s: 'X', p: 1, t: 1 })
    expect(frames.size).toBe(0)
  })

  it('keeps the buffer bounded by symbol count while frames do not run', () => {
    connected('A', 'B')
    for (let t = 0; t < 10_000; t++) adapter.emit({ s: t % 2 ? 'A' : 'B', p: t, t })
    expect(frames.size).toBe(1)
    frames.runFrame()
    expect(store.get('A')?.price).toBe(9999)
    expect(store.get('B')?.price).toBe(9998)
  })

  it('ignores ticks for symbols nobody subscribed to', () => {
    connected('A')
    adapter.emit({ s: 'A', p: 1, t: 1 }, { s: 'Z', p: 1, t: 1 })
    frames.runFrame()
    expect(store.get('Z')).toBeUndefined()
  })
})

describe('QuoteFeed subscriptions', () => {
  it('ref-counts: two retains give one upstream subscription', () => {
    connected()
    feed.retain('A')
    feed.retain('A')
    expect(adapter.subscribed).toEqual([['A']])

    feed.release('A')
    expect(adapter.unsubscribed).toEqual([])
    feed.release('A')
    expect(adapter.unsubscribed).toEqual([['A']])
  })

  it('does not send subscriptions before the socket is open, then sends all on open', () => {
    feed.setAdapter(adapter)
    feed.retain('A')
    feed.retain('B')
    feed.retain('A')
    expect(adapter.subscribed).toEqual([])
    adapter.open()
    expect(adapter.subscribed).toEqual([['A', 'B']])
  })

  it('resubscribes everything after a reconnect', () => {
    connected('A', 'B')
    feed.release('B')
    adapter.handlers?.onStatus('reconnecting')
    adapter.open()
    expect(adapter.subscribed).toEqual([['A', 'B'], ['A']])
  })

  it('ignores release of an unknown symbol', () => {
    connected()
    feed.release('nope')
    expect(adapter.unsubscribed).toEqual([])
  })

  it('drops a buffered tick when its symbol is released', () => {
    connected('A')
    adapter.emit({ s: 'A', p: 1, t: 1 })
    feed.release('A')
    frames.runFrame()
    expect(store.get('A')).toBeUndefined()
  })
})

describe('QuoteFeed source switching', () => {
  it('closes the old adapter, ignores its late ticks and keeps subscriptions', () => {
    connected('A')
    adapter.emit({ s: 'A', p: 1, t: 1 })
    const next = new FakeAdapter()
    feed.setAdapter(next)

    expect(adapter.closed).toBe(true)
    expect(frames.size).toBe(0)
    adapter.emit({ s: 'A', p: 2, t: 2 })
    expect(frames.size).toBe(0)

    next.open()
    expect(next.subscribed).toEqual([['A']])
  })

  it('reports connection status', () => {
    const listener = vi.fn()
    feed.onStatus(listener)
    feed.setAdapter(adapter)
    expect(feed.getStatus()).toBe('connecting')
    adapter.open()
    expect(feed.getStatus()).toBe('open')
    feed.setAdapter(null)
    expect(feed.getStatus()).toBe('idle')
    expect(listener).toHaveBeenCalledTimes(3)
  })
})
