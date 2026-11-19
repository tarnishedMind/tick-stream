import { useEffect, useState } from 'react'
import { FrameStats } from '../../data'
import { useQuotes } from '../../data/react'

export type LiveStatsValues = { fps: number; ticksPerSec: number; subscribed: number }

const INITIAL: LiveStatsValues = { fps: 0, ticksPerSec: 0, subscribed: 0 }

/**
 * FPS, received ticks/sec and subscribed rows, measured on every animation
 * frame and published to React every `displayIntervalMs`, so only the
 * component using it re-renders, and only that often.
 */
export function useLiveStats(displayIntervalMs: number): LiveStatsValues {
  const { feed } = useQuotes()
  const [stats, setStats] = useState(INITIAL)

  useEffect(() => {
    const meter = new FrameStats(feed.getTicksReceived, 1000)
    let lastShown = 0
    let handle = requestAnimationFrame(function loop(now) {
      const { fps, ticksPerSec } = meter.frame(now)
      if (now - lastShown >= displayIntervalMs) {
        lastShown = now
        setStats({ fps: Math.round(fps), ticksPerSec: Math.round(ticksPerSec), subscribed: feed.subscribedCount() })
      }
      handle = requestAnimationFrame(loop)
    })
    return () => cancelAnimationFrame(handle)
  }, [feed, displayIntervalMs])

  return stats
}
