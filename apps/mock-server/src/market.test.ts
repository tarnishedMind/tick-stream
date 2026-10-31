import { describe, expect, it } from 'vitest'
import { Market, TickPacer, symbolName } from './market'
import { parseClientMessage } from './protocol'

describe('TickPacer', () => {
  it('delivers the exact rate over time, including fractional rates', () => {
    const pacer = new TickPacer(0)
    let total = 0
    for (let now = 10; now <= 1000; now += 10) total += pacer.due(30, now)
    expect(total).toBe(30)
  })

  it('handles high rates per interval', () => {
    const pacer = new TickPacer(0)
    expect(pacer.due(50_000, 10)).toBe(500)
  })

  it('caps catch-up after a stall to one second of ticks', () => {
    const pacer = new TickPacer(0)
    expect(pacer.due(1000, 10_000)).toBe(1000)
  })

  it('emits nothing at 0 TPS', () => {
    const pacer = new TickPacer(0)
    expect(pacer.due(0, 1000)).toBe(0)
  })
})

describe('Market', () => {
  it('builds the symbol list and resizes it', () => {
    const market = new Market({ tps: 100, symbols: 3 })
    expect(market.symbols).toEqual([symbolName(0), symbolName(1), symbolName(2)])
    expect(market.configure({ symbols: 1 })).toBe(true)
    expect(market.symbols).toEqual(['SYM0000'])
    expect(market.has('SYM0002')).toBe(false)
  })

  it('clamps config to protocol limits and reports no-op changes', () => {
    const market = new Market({ tps: 100, symbols: 3 })
    expect(market.configure({ tps: 100 })).toBe(false)
    market.configure({ tps: 1e9, symbols: -5 })
    expect(market.tps).toBe(200_000)
    expect(market.symbols).toHaveLength(1)
  })

  it('random-walks within ±0.1% per tick', () => {
    const market = new Market({ tps: 1, symbols: 1 }, () => 1)
    expect(market.tick('SYM0000', 42)).toEqual({ s: 'SYM0000', p: 100.1, t: 42 })
  })
})

describe('parseClientMessage', () => {
  it('accepts valid messages', () => {
    expect(parseClientMessage('{"op":"subscribe","symbols":["A"]}')).toEqual({ op: 'subscribe', symbols: ['A'] })
    expect(parseClientMessage('{"op":"config","tps":5,"symbols":"x"}')).toEqual({ op: 'config', tps: 5 })
  })

  it('rejects garbage', () => {
    expect(parseClientMessage('nope')).toBeNull()
    expect(parseClientMessage('{"op":"subscribe","symbols":[1]}')).toBeNull()
    expect(parseClientMessage('null')).toBeNull()
  })
})
