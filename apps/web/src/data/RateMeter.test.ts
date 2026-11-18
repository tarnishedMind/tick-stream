import { describe, expect, it } from 'vitest'
import { RateMeter } from './RateMeter'

describe('RateMeter', () => {
  it('returns 0 until it has two samples', () => {
    const m = new RateMeter()
    expect(m.sample(0, 0)).toBe(0)
    expect(m.sample(100, 10)).toBe(100)
  })

  it('measures frames per second at a steady 60 Hz', () => {
    const m = new RateMeter(1000)
    let rate = 0
    for (let frame = 0; frame <= 180; frame++) rate = m.sample((frame * 1000) / 60, frame)
    expect(rate).toBeCloseTo(60, 5)
  })

  it('forgets samples older than the window', () => {
    const m = new RateMeter(1000)
    // 1000 ticks/sec for 3 s, then the source goes quiet.
    for (let t = 0; t <= 3000; t += 100) m.sample(t, t)
    expect(m.rate()).toBeCloseTo(1000, 5)
    let rate = 0
    for (let t = 3100; t <= 4500; t += 100) rate = m.sample(t, 3000)
    expect(rate).toBe(0)
  })

  it('reacts to a rate change within one window', () => {
    const m = new RateMeter(1000)
    let value = 0
    for (let t = 0; t <= 2000; t += 50) m.sample(t, (value += 5)) // 100/s
    let rate = 0
    for (let t = 2050; t <= 3100; t += 50) rate = m.sample(t, (value += 50)) // 1000/s
    expect(rate).toBeCloseTo(1000, 5)
  })

  it('stays bounded over long runs', () => {
    const m = new RateMeter(1000)
    for (let i = 0; i < 100_000; i++) m.sample(i * 16, i)
    expect(m.rate()).toBeCloseTo(62.5, 5)
  })
})
