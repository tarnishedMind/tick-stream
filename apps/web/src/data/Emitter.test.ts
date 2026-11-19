import { describe, expect, it, vi } from 'vitest'
import { Emitter } from './Emitter'

describe('Emitter', () => {
  it('notifies listeners until they unsubscribe', () => {
    const emitter = new Emitter()
    const a = vi.fn()
    const b = vi.fn()
    const offA = emitter.listen(a)
    emitter.listen(b)
    emitter.emit()
    offA()
    emitter.emit()
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(2)
    expect(emitter.size).toBe(1)
  })

  it('clear() drops every listener', () => {
    const emitter = new Emitter()
    const a = vi.fn()
    emitter.listen(a)
    emitter.clear()
    emitter.emit()
    expect(a).not.toHaveBeenCalled()
    expect(emitter.size).toBe(0)
  })
})
