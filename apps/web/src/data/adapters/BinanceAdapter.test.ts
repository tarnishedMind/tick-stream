import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QuoteFeed } from '../QuoteFeed'
import { QuoteStore } from '../QuoteStore'
import { FakeSocket, ManualFrames } from '../testing'
import type { RawTick } from '../types'
import { BinanceAdapter, toRawTick, type BinanceAdapterOptions } from './BinanceAdapter'
import { BINANCE_WS_URL } from './binanceProtocol'

const aggTrade = {
  e: 'aggTrade',
  E: 1_700_000_000_100,
  s: 'BTCUSDT',
  a: 26_129,
  p: '67012.34000000',
  q: '0.01200000',
  f: 100,
  l: 105,
  T: 1_700_000_000_050,
  m: true,
  M: true,
}

function setup(options: BinanceAdapterOptions = {}) {
  const ticks: RawTick[] = []
  const onOpen = vi.fn()
  const adapter = new BinanceAdapter({
    createSocket: (url) => new FakeSocket(url),
    backoff: { baseMs: 100, maxMs: 1000 },
    random: () => 0.5,
    ...options,
  })
  adapter.connect({ onTicks: (t) => ticks.push(...t), onOpen, onStatus: () => {} })
  const socket = () => FakeSocket.instances.at(-1)!
  socket().serverOpen()
  const frames = () => socket().sent.map((s) => JSON.parse(s))
  return { adapter, ticks, onOpen, socket, frames }
}

beforeEach(() => {
  FakeSocket.instances = []
  vi.useFakeTimers()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('aggTrade mapping', () => {
  it('maps symbol, numeric price and trade time', () => {
    expect(toRawTick(aggTrade)).toEqual({ s: 'BTCUSDT', p: 67012.34, t: 1_700_000_000_050 })
  })

  it('rejects other events and malformed payloads', () => {
    expect(toRawTick({ ...aggTrade, e: 'trade' })).toBeNull()
    expect(toRawTick({ ...aggTrade, p: 'abc' })).toBeNull()
    expect(toRawTick({ ...aggTrade, p: 1 })).toBeNull()
    expect(toRawTick({ ...aggTrade, T: undefined })).toBeNull()
    expect(toRawTick(null)).toBeNull()
  })

  it('emits ticks from raw and combined-stream messages, ignores replies and junk', () => {
    const { ticks, socket } = setup()
    socket().serverMessage(JSON.stringify(aggTrade))
    socket().serverMessage(JSON.stringify({ stream: 'ethusdt@aggTrade', data: { ...aggTrade, s: 'ETHUSDT', p: '3500.5' } }))
    socket().serverMessage('{"result":null,"id":1}')
    socket().serverMessage('not json')
    expect(ticks).toEqual([
      { s: 'BTCUSDT', p: 67012.34, t: 1_700_000_000_050 },
      { s: 'ETHUSDT', p: 3500.5, t: 1_700_000_000_050 },
    ])
  })
})

describe('BinanceAdapter frames', () => {
  it('connects to the market data endpoint', () => {
    const { socket } = setup()
    expect(socket().url).toBe(BINANCE_WS_URL)
  })

  it('sends SUBSCRIBE / UNSUBSCRIBE with aggTrade streams and increasing ids', () => {
    const { adapter, frames } = setup()
    adapter.subscribe(['BTCUSDT', 'ETHUSDT'])
    vi.advanceTimersByTime(0)
    adapter.unsubscribe(['ETHUSDT'])
    vi.advanceTimersByTime(1000)
    expect(frames()).toEqual([
      { method: 'SUBSCRIBE', params: ['btcusdt@aggTrade', 'ethusdt@aggTrade'], id: 1 },
      { method: 'UNSUBSCRIBE', params: ['ethusdt@aggTrade'], id: 2 },
    ])
  })

  it('coalesces a burst of calls into one frame and cancels out sub + unsub', () => {
    const { adapter, frames } = setup()
    for (const s of ['BTCUSDT', 'ETHUSDT', 'SOLUSDT']) adapter.subscribe([s])
    adapter.subscribe(['XRPUSDT'])
    adapter.unsubscribe(['XRPUSDT'])
    vi.advanceTimersByTime(0)
    expect(frames()).toEqual([
      { method: 'SUBSCRIBE', params: ['btcusdt@aggTrade', 'ethusdt@aggTrade', 'solusdt@aggTrade'], id: 1 },
    ])
  })

  it('rate-limits control frames', () => {
    const { adapter, socket } = setup({ controlFramesPerSecond: 2, maxParamsPerFrame: 1 })
    adapter.subscribe(['A', 'B', 'C', 'D', 'E'])
    vi.advanceTimersByTime(0)
    expect(socket().sent).toHaveLength(1)
    vi.advanceTimersByTime(499)
    expect(socket().sent).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(socket().sent).toHaveLength(2)
    vi.advanceTimersByTime(1500)
    expect(socket().sent).toHaveLength(5)
    vi.advanceTimersByTime(5000)
    expect(socket().sent).toHaveLength(5)
  })

  it('never exceeds 5 frames in any second with default settings', () => {
    const { adapter, socket } = setup({ maxParamsPerFrame: 1 })
    const sentAt: number[] = []
    const send = socket().send.bind(socket())
    socket().send = (data) => {
      sentAt.push(Date.now())
      send(data)
    }
    adapter.subscribe(Array.from({ length: 30 }, (_, i) => `S${i}`))
    vi.advanceTimersByTime(20_000)
    expect(sentAt).toHaveLength(30)
    for (const t of sentAt) expect(sentAt.filter((u) => u >= t && u < t + 1000).length).toBeLessThan(5)
  })

  it('caps streams per connection and frees slots on unsubscribe', () => {
    const { adapter, frames } = setup({ maxStreams: 3 })
    adapter.subscribe(['A', 'B', 'C', 'D', 'E'])
    vi.advanceTimersByTime(5000)
    expect(adapter.activeSymbols()).toEqual(['A', 'B', 'C'])
    expect(console.warn).toHaveBeenCalledTimes(1)

    adapter.unsubscribe(['A'])
    vi.advanceTimersByTime(5000)
    expect(adapter.activeSymbols()).toEqual(['B', 'C', 'D'])
    expect(frames().map((f) => [f.method, f.params])).toEqual([
      ['SUBSCRIBE', ['a@aggTrade', 'b@aggTrade', 'c@aggTrade']],
      ['UNSUBSCRIBE', ['a@aggTrade']],
      ['SUBSCRIBE', ['d@aggTrade']],
    ])
  })

  it('forgets streams whose SUBSCRIBE the server rejected', () => {
    const { adapter, socket } = setup()
    adapter.subscribe(['BTCUSDT'])
    vi.advanceTimersByTime(0)
    socket().serverMessage('{"code":2,"msg":"Invalid request","id":1}')
    expect(adapter.activeSymbols()).toEqual([])
    expect(console.warn).toHaveBeenCalled()
  })
})

describe('BinanceAdapter reconnect', () => {
  it('resubscribes through the feed after a drop (e.g. the 24h disconnect)', () => {
    const adapter = new BinanceAdapter({
      createSocket: (url) => new FakeSocket(url),
      backoff: { baseMs: 100, maxMs: 1000 },
      random: () => 0.5,
    })
    const feed = new QuoteFeed(new QuoteStore(), new ManualFrames())
    feed.setAdapter(adapter)
    FakeSocket.instances.at(-1)!.serverOpen()
    feed.retain('BTCUSDT')
    feed.retain('ETHUSDT')
    vi.advanceTimersByTime(1000)

    FakeSocket.instances.at(-1)!.serverDrop()
    expect(adapter.activeSymbols()).toEqual([])
    vi.advanceTimersByTime(1000)
    const next = FakeSocket.instances.at(-1)!
    expect(FakeSocket.instances).toHaveLength(2)
    next.serverOpen()
    vi.advanceTimersByTime(0)
    expect(next.sent.map((s) => JSON.parse(s))).toEqual([
      { method: 'SUBSCRIBE', params: ['btcusdt@aggTrade', 'ethusdt@aggTrade'], id: 2 },
    ])
  })

  it('reconnects when a subscribed connection goes silent', () => {
    const { adapter, socket, onOpen } = setup({ staleAfterMs: 3000 })
    adapter.subscribe(['BTCUSDT'])
    vi.advanceTimersByTime(2000)
    socket().serverMessage(JSON.stringify(aggTrade))
    vi.advanceTimersByTime(2000)
    expect(FakeSocket.instances).toHaveLength(1)

    vi.advanceTimersByTime(2000) // 4 s without a message
    expect(FakeSocket.instances[0]!.closeCalls).toBe(1)
    vi.advanceTimersByTime(1000)
    expect(FakeSocket.instances).toHaveLength(2)
    socket().serverOpen()
    expect(onOpen).toHaveBeenCalledTimes(2)
  })

  it('does not treat silence without subscriptions as stale', () => {
    setup({ staleAfterMs: 3000 })
    vi.advanceTimersByTime(60_000)
    expect(FakeSocket.instances).toHaveLength(1)
  })

  it('stops timers on close()', () => {
    const { adapter, socket } = setup({ staleAfterMs: 3000 })
    adapter.subscribe(['BTCUSDT'])
    adapter.close()
    vi.advanceTimersByTime(60_000)
    expect(socket().sent).toEqual([])
    expect(FakeSocket.instances).toHaveLength(1)
  })
})
