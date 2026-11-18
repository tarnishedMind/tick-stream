/**
 * Rate of a monotonic counter over a rolling time window.
 *
 * Feed it `(time, cumulativeValue)` samples (e.g. once per animation frame)
 * and it returns the per-second rate over roughly the last `windowMs`.
 * Used for FPS (counter = frames) and received ticks/sec (counter = ticks).
 */
export class RateMeter {
  private times: number[] = []
  private values: number[] = []
  private head = 0

  constructor(private readonly windowMs = 1000) {}

  /** Record a sample and return the current rate per second. */
  sample(time: number, value: number): number {
    this.times.push(time)
    this.values.push(value)
    // Keep exactly one sample at or before the window start, so the rate
    // always spans the full window once enough history exists.
    const start = time - this.windowMs
    while (this.times.length - this.head > 2 && this.times[this.head + 1]! <= start) this.head += 1
    if (this.head > 256) this.compact()
    return this.rate()
  }

  rate(): number {
    const last = this.times.length - 1
    if (last - this.head < 1) return 0
    const dt = this.times[last]! - this.times[this.head]!
    if (dt <= 0) return 0
    return ((this.values[last]! - this.values[this.head]!) * 1000) / dt
  }

  reset(): void {
    this.times = []
    this.values = []
    this.head = 0
  }

  private compact(): void {
    this.times = this.times.slice(this.head)
    this.values = this.values.slice(this.head)
    this.head = 0
  }
}
