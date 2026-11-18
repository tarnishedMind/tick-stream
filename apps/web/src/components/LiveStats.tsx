import { useEffect, useState } from 'react'
import { RateMeter, useQuotes } from '../data'

/** How often the readout re-renders. Measuring happens every frame regardless. */
const DISPLAY_INTERVAL_MS = 250

type Stats = { fps: number; ticksPerSec: number; subscribed: number }

/**
 * FPS and received ticks/sec, both over a rolling 1 s window, sampled on
 * every animation frame. Only this component re-renders when they change.
 */
export function LiveStats() {
  const { feed } = useQuotes()
  const [stats, setStats] = useState<Stats>({ fps: 0, ticksPerSec: 0, subscribed: 0 })

  useEffect(() => {
    const fpsMeter = new RateMeter(1000)
    const tickMeter = new RateMeter(1000)
    let frames = 0
    let lastShown = 0
    let handle = requestAnimationFrame(function loop(now) {
      frames += 1
      const fps = fpsMeter.sample(now, frames)
      const ticksPerSec = tickMeter.sample(now, feed.getTicksReceived())
      if (now - lastShown >= DISPLAY_INTERVAL_MS) {
        lastShown = now
        setStats({ fps: Math.round(fps), ticksPerSec: Math.round(ticksPerSec), subscribed: feed.subscribedCount() })
      }
      handle = requestAnimationFrame(loop)
    })
    return () => cancelAnimationFrame(handle)
  }, [feed])

  return (
    <div className="stats" aria-live="off">
      <Stat label="FPS" value={stats.fps} tone={stats.fps >= 55 ? 'up' : stats.fps >= 30 ? '' : 'down'} />
      <Stat label="Received ticks/sec" value={stats.ticksPerSec} />
      <Stat label="Subscribed rows" value={stats.subscribed} />
    </div>
  )
}

function Stat({ label, value, tone = '' }: { label: string; value: number; tone?: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className={`stat-value ${tone}`}>{value.toLocaleString('en-US')}</span>
    </div>
  )
}
