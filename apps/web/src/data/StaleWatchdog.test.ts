import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StaleWatchdog } from './StaleWatchdog'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('StaleWatchdog', () => {
  it('fires after the timeout without touch(), only while watching', () => {
    let watching = false
    const onStale = vi.fn()
    const dog = new StaleWatchdog({ timeoutMs: 300, isWatching: () => watching, onStale })
    dog.start()
    vi.advanceTimersByTime(1000)
    expect(onStale).not.toHaveBeenCalled()

    watching = true
    dog.touch()
    vi.advanceTimersByTime(200)
    dog.touch()
    vi.advanceTimersByTime(200)
    expect(onStale).not.toHaveBeenCalled()
    vi.advanceTimersByTime(200)
    expect(onStale).toHaveBeenCalled()
  })

  it('does nothing after stop() or with timeout 0', () => {
    const onStale = vi.fn()
    const dog = new StaleWatchdog({ timeoutMs: 300, isWatching: () => true, onStale })
    dog.start()
    dog.stop()
    new StaleWatchdog({ timeoutMs: 0, isWatching: () => true, onStale }).start()
    vi.advanceTimersByTime(10_000)
    expect(onStale).not.toHaveBeenCalled()
  })
})
