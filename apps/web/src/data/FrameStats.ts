import { RateMeter } from './RateMeter'

export type FrameStatsSample = { fps: number; ticksPerSec: number }

/**
 * Frames per second and ticks per second over a rolling window. Call
 * `frame(now)` once per animation frame; it counts the frame and samples the
 * tick counter. Shared by the live readout and benchmarks, so both measure
 * the same way.
 */
export class FrameStats {
  private frames = 0
  private readonly fpsMeter: RateMeter
  private readonly tickMeter: RateMeter

  constructor(
    /** Monotonic tick counter, e.g. `feed.getTicksReceived`. */
    private readonly getTicks: () => number,
    windowMs = 1000,
  ) {
    this.fpsMeter = new RateMeter(windowMs)
    this.tickMeter = new RateMeter(windowMs)
  }

  frame(now: number): FrameStatsSample {
    this.frames += 1
    return {
      fps: this.fpsMeter.sample(now, this.frames),
      ticksPerSec: this.tickMeter.sample(now, this.getTicks()),
    }
  }
}
