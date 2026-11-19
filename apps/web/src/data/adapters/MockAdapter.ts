import { parseJson, type ClientMessage, type ServerConfig, type ServerConfigMessage } from '@tick-stream/protocol'
import { Emitter } from '../Emitter'
import type { RawTick } from '../types'
import { WsAdapter, type WsAdapterOptions } from '../WsAdapter'

export const DEFAULT_MOCK_URL: string = import.meta.env?.VITE_MOCK_URL ?? 'ws://localhost:8080'

/**
 * Adapter for the local mock server. Besides ticks, the server reports its
 * load settings and symbol list; `setLoad` changes them at runtime.
 */
export class MockAdapter extends WsAdapter {
  readonly name = 'mock'
  private config: ServerConfig | null = null
  private readonly configChanged = new Emitter()

  constructor(
    private readonly endpoint: string = DEFAULT_MOCK_URL,
    options?: WsAdapterOptions,
  ) {
    super(options)
  }

  /**
   * Latest config reported by the server, or null before the first one arrives.
   * The server re-sends its full symbol list with every config change (e.g. each
   * slider step); `symbols` keeps the previous array while the contents match,
   * so consumers can compare it by reference.
   */
  getConfig = (): ServerConfig | null => this.config

  onConfig = (listener: () => void): (() => void) => this.configChanged.listen(listener)

  /** Ask the server to change ticks/sec and/or the number of symbols. */
  setLoad(load: { tps?: number; symbols?: number }): void {
    this.send(encode({ op: 'config', ...load }))
  }

  protected url(): string {
    return this.endpoint
  }

  protected parse(data: unknown): RawTick[] {
    const msg = parseJson(data)
    if (Array.isArray(msg)) return msg as RawTick[]
    if (isConfigMessage(msg)) {
      const prev = this.config?.symbols
      const symbols = prev && sameItems(prev, msg.symbols) ? prev : msg.symbols
      this.config = { tps: msg.tps, symbols }
      this.configChanged.emit()
    }
    return []
  }

  protected subscribeMessage(symbols: readonly string[]): string {
    return encode({ op: 'subscribe', symbols: [...symbols] })
  }

  protected unsubscribeMessage(symbols: readonly string[]): string {
    return encode({ op: 'unsubscribe', symbols: [...symbols] })
  }
}

function encode(msg: ClientMessage): string {
  return JSON.stringify(msg)
}

function isConfigMessage(msg: unknown): msg is ServerConfigMessage {
  if (typeof msg !== 'object' || msg === null) return false
  const m = msg as Record<string, unknown>
  return m.type === 'config' && typeof m.tps === 'number' && Array.isArray(m.symbols)
}

function sameItems(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((s, i) => s === b[i])
}
