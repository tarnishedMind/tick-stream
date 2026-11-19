import { describe, expect, it, vi } from 'vitest'
import { SubscriptionPlanner } from './SubscriptionPlanner'

const planner = (maxStreams = 10, maxPerChange = 10, onOverLimit = vi.fn()) =>
  new SubscriptionPlanner({ maxStreams, maxPerChange }, onOverLimit)

describe('SubscriptionPlanner', () => {
  it('turns wanted symbols into one subscribe and then has nothing to do', () => {
    const p = planner()
    p.want(['A', 'B'])
    expect(p.next()).toEqual({ op: 'subscribe', symbols: ['A', 'B'] })
    expect(p.activeSymbols()).toEqual(['A', 'B'])
    expect(p.next()).toBeNull()
  })

  it('cancels out a want undone before the next change', () => {
    const p = planner()
    p.want(['A', 'B'])
    p.unwant(['B'])
    expect(p.next()).toEqual({ op: 'subscribe', symbols: ['A'] })
  })

  it('sends unsubscribes before subscribes', () => {
    const p = planner()
    p.want(['A'])
    p.next()
    p.unwant(['A'])
    p.want(['B'])
    expect(p.next()).toEqual({ op: 'unsubscribe', symbols: ['A'] })
    expect(p.next()).toEqual({ op: 'subscribe', symbols: ['B'] })
  })

  it('splits changes by maxPerChange', () => {
    const p = planner(10, 2)
    p.want(['A', 'B', 'C'])
    expect(p.next()?.symbols).toEqual(['A', 'B'])
    expect(p.next()?.symbols).toEqual(['C'])
  })

  it('caps active symbols at maxStreams and reports it once', () => {
    const onOverLimit = vi.fn()
    const p = planner(2, 10, onOverLimit)
    p.want(['A', 'B', 'C'])
    expect(p.next()?.symbols).toEqual(['A', 'B'])
    expect(p.next()).toBeNull()
    expect(onOverLimit).toHaveBeenCalledTimes(1)
    expect(onOverLimit).toHaveBeenCalledWith(3, 2)
    p.unwant(['A'])
    expect(p.next()).toEqual({ op: 'unsubscribe', symbols: ['A'] })
    expect(p.next()).toEqual({ op: 'subscribe', symbols: ['C'] })
  })

  it('retries rejected subscriptions on the next change', () => {
    const p = planner()
    p.want(['A'])
    p.next()
    p.rejected(['A'])
    expect(p.activeSymbols()).toEqual([])
    expect(p.next()).toEqual({ op: 'subscribe', symbols: ['A'] })
  })

  it('reset() forgets wanted and active symbols', () => {
    const p = planner()
    p.want(['A'])
    p.next()
    p.reset()
    expect(p.activeCount).toBe(0)
    expect(p.next()).toBeNull()
  })
})
