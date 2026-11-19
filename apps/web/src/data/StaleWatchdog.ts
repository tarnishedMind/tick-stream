export type StaleWatchdogOptions = {
  /** Silence longer than this counts as stale (ms). 0 disables the watchdog. */
  timeoutMs: number
  /** Only while this returns true is silence a problem (e.g. while subscribed). */
  isWatching(): boolean
  onStale(): void
  now?: () => number
}

/**
 * Detects a connection that has gone quiet without the browser noticing
 * (half-open TCP). Call `touch()` on every sign of life; checks run three
 * times per timeout.
 */
export class StaleWatchdog {
  private timer: ReturnType<typeof setInterval> | null = null
  private lastSeen = 0
  private readonly now: () => number

  constructor(private readonly options: StaleWatchdogOptions) {
    this.now = options.now ?? Date.now
  }

  start(): void {
    this.stop()
    this.touch()
    const { timeoutMs } = this.options
    if (timeoutMs > 0) this.timer = setInterval(this.check, Math.max(1, Math.floor(timeoutMs / 3)))
  }

  touch(): void {
    this.lastSeen = this.now()
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null
  }

  private readonly check = (): void => {
    if (!this.options.isWatching()) return
    if (this.now() - this.lastSeen < this.options.timeoutMs) return
    this.options.onStale()
  }
}
