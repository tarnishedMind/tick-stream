type Listener = () => void

/**
 * A set of no-argument listeners. The building block for the small external
 * stores here (`useSyncExternalStore` subscribe functions return its unsubscribe).
 */
export class Emitter {
  private readonly listeners = new Set<Listener>()

  get size(): number {
    return this.listeners.size
  }

  /** Add a listener; returns a function that removes it. */
  listen(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  emit(): void {
    for (const listener of this.listeners) listener()
  }

  clear(): void {
    this.listeners.clear()
  }
}
