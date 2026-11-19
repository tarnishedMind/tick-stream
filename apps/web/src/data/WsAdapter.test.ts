import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeSockets, recordingHandlers } from '../test/fakes'
import type { RawTick } from './types'
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
  const sockets = fakeSockets()
  const { handlers, statuses, ticks, onOpen } = recordingHandlers()
  const adapter = new JsonAdapter({
    backoff: { baseMs: 100, maxMs: 1000 },
    createSocket: sockets.create,
    random: () => 0.5,
  })
  adapter.connect(handlers)
  return { adapter, statuses, ticks, onOpen, sockets, socket: sockets.last }
}

beforeEach(() => {
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
    const { statuses, onOpen, socket, sockets } = setup()
    socket().serverOpen()

    socket().serverDrop() // attempt 0: 0.5 * 100 = 50 ms
    expect(statuses.at(-1)).toBe('reconnecting')
    vi.advanceTimersByTime(49)
    expect(sockets.all).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(sockets.all).toHaveLength(2)

    socket().serverDrop() // attempt 1: 0.5 * 200 = 100 ms
    vi.advanceTimersByTime(99)
    expect(sockets.all).toHaveLength(2)
    vi.advanceTimersByTime(1)
    expect(sockets.all).toHaveLength(3)

    socket().serverOpen()
    expect(onOpen).toHaveBeenCalledTimes(2)
    socket().serverDrop() // reset to attempt 0: 50 ms
    vi.advanceTimersByTime(50)
    expect(sockets.all).toHaveLength(4)
  })

  it('does not reconnect after close()', () => {
    const { adapter, statuses, socket, sockets } = setup()
    socket().serverOpen()
    const s = socket()
    adapter.close()
    s.serverDrop()
    vi.advanceTimersByTime(60_000)
    expect(sockets.all).toHaveLength(1)
    expect(s.closeCalls).toBe(1)
    expect(statuses.at(-1)).toBe('closed')
  })

  it('cancels a pending reconnect on close()', () => {
    const { adapter, socket, sockets } = setup()
    socket().serverDrop()
    adapter.close()
    vi.advanceTimersByTime(60_000)
    expect(sockets.all).toHaveLength(1)
  })
})
