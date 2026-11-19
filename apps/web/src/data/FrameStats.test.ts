import { describe, expect, it } from 'vitest'
import { FrameStats } from './FrameStats'

describe('FrameStats', () => {
  it('reports frames and ticks per second over the window', () => {
    let ticks = 0
    const stats = new FrameStats(() => ticks, 1000)
    let last = { fps: 0, ticksPerSec: 0 }
    // 60 frames over one second, 100 ticks per frame.
    for (let i = 0; i <= 60; i++) {
      ticks += 100
      last = stats.frame((i * 1000) / 60)
    }
    expect(last.fps).toBeCloseTo(60, 5)
    expect(last.ticksPerSec).toBeCloseTo(6000, 5)
  })

  it('reports 0 before a second sample exists', () => {
    expect(new FrameStats(() => 5).frame(0)).toEqual({ fps: 0, ticksPerSec: 0 })
  })
})
