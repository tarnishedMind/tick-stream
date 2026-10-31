import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeSocket } from '../testing'
import type { RawTick } from '../types'
import { MockAdapter } from './MockAdapter'

function setup() {
  const ticks: RawTick[] = []
  const adapter = new MockAdapter('ws://mock', { createSocket: (url) => new FakeSocket(url) })
  adapter.connect({ onTicks: (t) => ticks.push(...t), onOpen: () => {}, onStatus: () => {} })
  const socket = FakeSocket.instances.at(-1)!
  socket.serverOpen()
  return { adapter, ticks, socket }
}

beforeEach(() => {
  FakeSocket.instances = []
})

describe('MockAdapter', () => {
  it('connects to the given endpoint', () => {
    const { socket } = setup()
    expect(socket.url).toBe('ws://mock')
  })

  it('parses tick batches', () => {
    const { ticks, socket } = setup()
    socket.serverMessage('[{"s":"SYM0000","p":100.1,"t":1}]')
    expect(ticks).toEqual([{ s: 'SYM0000', p: 100.1, t: 1 }])
  })

  it('stores server config and notifies listeners without emitting ticks', () => {
    const { adapter, ticks, socket } = setup()
    const listener = vi.fn()
    adapter.onConfig(listener)
    socket.serverMessage('{"type":"config","tps":500,"symbols":["SYM0000","SYM0001"]}')
    expect(adapter.getConfig()).toEqual({ tps: 500, symbols: ['SYM0000', 'SYM0001'] })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(ticks).toEqual([])
  })

  it('ignores malformed messages', () => {
    const { adapter, ticks, socket } = setup()
    socket.serverMessage('not json')
    socket.serverMessage('{"type":"config"}')
    expect(ticks).toEqual([])
    expect(adapter.getConfig()).toBeNull()
  })

  it('speaks the subscribe / unsubscribe / config protocol', () => {
    const { adapter, socket } = setup()
    adapter.subscribe(['SYM0000', 'SYM0001'])
    adapter.unsubscribe(['SYM0001'])
    adapter.setLoad({ tps: 10_000 })
    expect(socket.sent.map((s) => JSON.parse(s))).toEqual([
      { op: 'subscribe', symbols: ['SYM0000', 'SYM0001'] },
      { op: 'unsubscribe', symbols: ['SYM0001'] },
      { op: 'config', tps: 10_000 },
    ])
  })
})
