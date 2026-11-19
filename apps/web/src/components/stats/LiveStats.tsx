import { formatInteger } from '../../format'
import { useLiveStats } from './useLiveStats'

/** How often the readout re-renders. Measuring happens every frame regardless. */
const DISPLAY_INTERVAL_MS = 250

/** FPS at or above this reads as healthy (green). */
const FPS_GOOD = 55
/** FPS below this reads as a problem (red); in between is neutral. */
const FPS_POOR = 30

type Tone = '' | 'up' | 'down'

function fpsTone(fps: number): Tone {
  if (fps >= FPS_GOOD) return 'up'
  return fps >= FPS_POOR ? '' : 'down'
}

/** FPS and received ticks/sec, both over a rolling 1 s window, plus subscribed rows. */
export function LiveStats() {
  const stats = useLiveStats(DISPLAY_INTERVAL_MS)
  return (
    <div className="stats" aria-live="off">
      <Stat label="FPS" value={stats.fps} tone={fpsTone(stats.fps)} />
      <Stat label="Received ticks/sec" value={stats.ticksPerSec} />
      <Stat label="Subscribed rows" value={stats.subscribed} />
    </div>
  )
}

function Stat({ label, value, tone = '' }: { label: string; value: number; tone?: Tone }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className={`stat-value ${tone}`}>{formatInteger(value)}</span>
    </div>
  )
}
