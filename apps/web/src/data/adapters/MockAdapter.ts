import type { RawTick } from '../types'
import { WsAdapter, type WsAdapterOptions } from '../WsAdapter'
import type { MockClientMessage, MockServerConfig, MockServerConfigMessage } from './mockProtocol'

export const DEFAULT_MOCK_URL: string = import.meta.env?.VITE_MOCK_URL ?? 'ws://localhost:8080'

/**
 * Adapter for the local mock server. Besides ticks, the server reports its
 * load settings and symbol list; `setLoad` changes them at runtime.
 */
export class MockAdapter extends WsAdapter {
  readonly name = 'mock'
  private config: MockServerConfig | null = null
  private readonly configListeners = new Set<() => void>()

  constructor(
    private readonly endpoint: string = DEFAULT_MOCK_URL,
    options?: WsAdapterOptions,
  ) {
    super(options)
  }

  /** Latest config reported by the server, or null before the first one arrives. */
  getConfig = (): MockServerConfig | null => this.config

  onConfig = (listener: () => void): (() => void) => {
    this.configListeners.add(listener)
    return () => this.configListeners.delete(listener)
  }

  /** Ask the server to change ticks/sec and/or the number of symbols. */
  setLoad(load: { tps?: number; symbols?: number }): void {
    this.send(this.encode({ op: 'config', ...load }))
  }

  protected url(): string {
    return this.endpoint
  }

  protected parse(data: unknown): RawTick[] {
    if (typeof data !== 'string') return []
    let msg: unknown
    try {
      msg = JSON.parse(data)
    } catch {
      return []
    }
    if (Array.isArray(msg)) return msg as RawTick[]
    if (isConfigMessage(msg)) {
      this.config = { tps: msg.tps, symbols: msg.symbols }
      for (const listener of this.configListeners) listener()
    }
    return []
  }

  protected subscribeMessage(symbols: readonly string[]): string {
    return this.encode({ op: 'subscribe', symbols: [...symbols] })
  }

  protected unsubscribeMessage(symbols: readonly string[]): string {
    return this.encode({ op: 'unsubscribe', symbols: [...symbols] })
  }

  private encode(msg: MockClientMessage): string {
    return JSON.stringify(msg)
  }
}

function isConfigMessage(msg: unknown): msg is MockServerConfigMessage {
  if (typeof msg !== 'object' || msg === null) return false
  const m = msg as Record<string, unknown>
  return m.type === 'config' && typeof m.tps === 'number' && Array.isArray(m.symbols)
}
