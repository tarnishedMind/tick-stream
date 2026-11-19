import { describe, expect, it, vi } from 'vitest'
import { fakeSockets, recordingHandlers } from '../../test/fakes'
import { MockAdapter } from './MockAdapter'

function setup() {
  const sockets = fakeSockets()
  const { handlers, ticks } = recordingHandlers()
  const adapter = new MockAdapter('ws://mock', { createSocket: sockets.create })
  adapter.connect(handlers)
  const socket = sockets.last()
  socket.serverOpen()
  return { adapter, ticks, socket }
}

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

  it('keeps the symbols array while the server re-sends the same list', () => {
    const { adapter, socket } = setup()
    socket.serverMessage('{"type":"config","tps":500,"symbols":["SYM0000","SYM0001"]}')
    const first = adapter.getConfig()!
    socket.serverMessage('{"type":"config","tps":1000,"symbols":["SYM0000","SYM0001"]}')
    const second = adapter.getConfig()!
    expect(second).not.toBe(first)
    expect(second.tps).toBe(1000)
    expect(second.symbols).toBe(first.symbols)
    socket.serverMessage('{"type":"config","tps":1000,"symbols":["SYM0000"]}')
    expect(adapter.getConfig()!.symbols).toEqual(['SYM0000'])
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
