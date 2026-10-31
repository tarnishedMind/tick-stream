import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeSocket } from './testing'
import type { AdapterHandlers, ConnectionStatus, RawTick } from './types'
import { WsAdapter } from './WsAdapter'

class JsonAdapter extends WsAdapter {
  readonly name = 'json'
  protected url() {
    return 'ws://test'
  }
  protected parse(data: unknown): RawTick[] {
    return JSON.parse(String(data)) as RawTick[]
  }
  protected subscribeMessage(symbols: readonly string[]) {
    return JSON.stringify({ op: 'sub', symbols })
  }
  protected unsubscribeMessage(symbols: readonly string[]) {
    return JSON.stringify({ op: 'unsub', symbols })
  }
}

function setup() {
  const statuses: ConnectionStatus[] = []
  const ticks: RawTick[] = []
  const onOpen = vi.fn()
  const handlers: AdapterHandlers = {
    onTicks: (t) => ticks.push(...t),
    onOpen,
    onStatus: (s) => statuses.push(s),
  }
  const adapter = new JsonAdapter({
    backoff: { baseMs: 100, maxMs: 1000 },
    createSocket: (url) => new FakeSocket(url),
    random: () => 0.5,
  })
  adapter.connect(handlers)
  return { adapter, statuses, ticks, onOpen, socket: () => FakeSocket.instances.at(-1)! }
}

beforeEach(() => {
  FakeSocket.instances = []
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('WsAdapter', () => {
  it('connects, reports status and parses messages', () => {
    const { statuses, ticks, onOpen, socket } = setup()
    socket().serverOpen()
    socket().serverMessage(JSON.stringify([{ s: 'A', p: 1, t: 1 }]))
    expect(statuses).toEqual(['connecting', 'open'])
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(ticks).toEqual([{ s: 'A', p: 1, t: 1 }])
  })

  it('sends subscribe/unsubscribe only while open', () => {
    const { adapter, socket } = setup()
    adapter.subscribe(['A'])
    expect(socket().sent).toEqual([])
    socket().serverOpen()
    adapter.subscribe(['A', 'B'])
    adapter.unsubscribe(['B'])
    adapter.subscribe([])
    expect(socket().sent).toEqual(['{"op":"sub","symbols":["A","B"]}', '{"op":"unsub","symbols":["B"]}'])
  })

  it('reconnects with growing backoff and resets it after a successful open', () => {
    const { statuses, onOpen, socket } = setup()
    socket().serverOpen()

    socket().serverDrop() // attempt 0: 0.5 * 100 = 50 ms
    expect(statuses.at(-1)).toBe('reconnecting')
    vi.advanceTimersByTime(49)
    expect(FakeSocket.instances).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(FakeSocket.instances).toHaveLength(2)

    socket().serverDrop() // attempt 1: 0.5 * 200 = 100 ms
    vi.advanceTimersByTime(99)
    expect(FakeSocket.instances).toHaveLength(2)
    vi.advanceTimersByTime(1)
    expect(FakeSocket.instances).toHaveLength(3)

    socket().serverOpen()
    expect(onOpen).toHaveBeenCalledTimes(2)
    socket().serverDrop() // reset to attempt 0: 50 ms
    vi.advanceTimersByTime(50)
    expect(FakeSocket.instances).toHaveLength(4)
  })

  it('does not reconnect after close()', () => {
    const { adapter, statuses, socket } = setup()
    socket().serverOpen()
    const s = socket()
    adapter.close()
    s.serverDrop()
    vi.advanceTimersByTime(60_000)
    expect(FakeSocket.instances).toHaveLength(1)
    expect(s.closeCalls).toBe(1)
    expect(statuses.at(-1)).toBe('closed')
  })

  it('cancels a pending reconnect on close()', () => {
    const { adapter, socket } = setup()
    socket().serverDrop()
    adapter.close()
    vi.advanceTimersByTime(60_000)
    expect(FakeSocket.instances).toHaveLength(1)
  })
})
