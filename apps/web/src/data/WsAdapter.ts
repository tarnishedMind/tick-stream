import { DEFAULT_BACKOFF, backoffDelay, type BackoffOptions } from './backoff'
import type { Adapter, AdapterHandlers, RawTick } from './types'

/** Minimal WebSocket surface the adapter uses; lets tests inject a fake. */
export interface SocketLike {
  readonly readyState: number
  onopen: ((ev: unknown) => void) | null
  onclose: ((ev: unknown) => void) | null
  onerror: ((ev: unknown) => void) | null
  onmessage: ((ev: { data: unknown }) => void) | null
  send(data: string): void
  close(): void
}

export type SocketFactory = (url: string) => SocketLike

const OPEN = 1

export type WsAdapterOptions = {
  backoff?: BackoffOptions
  createSocket?: SocketFactory
  random?: () => number
}

/**
 * Base class for WebSocket-backed adapters. Owns the socket lifecycle and
 * reconnects with exponential backoff + jitter. Subclasses only describe the
 * protocol: where to connect, how to parse a message, how to (un)subscribe.
 */
export abstract class WsAdapter implements Adapter {
  abstract readonly name: string

  private socket: SocketLike | null = null
  private handlers: AdapterHandlers | null = null
  private attempt = 0
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private closedByUser = false
  private readonly backoff: BackoffOptions
  private readonly createSocket: SocketFactory
  private readonly random: () => number

  constructor(options: WsAdapterOptions = {}) {
    this.backoff = options.backoff ?? DEFAULT_BACKOFF
    this.createSocket = options.createSocket ?? ((url) => new WebSocket(url) as SocketLike)
    this.random = options.random ?? Math.random
  }

  protected abstract url(): string
  /** Turn one socket message into zero or more normalized ticks. */
  protected abstract parse(data: unknown): RawTick[]
  protected abstract subscribeMessage(symbols: readonly string[]): string
  protected abstract unsubscribeMessage(symbols: readonly string[]): string

  connect(handlers: AdapterHandlers): void {
    this.handlers = handlers
    this.closedByUser = false
    this.attempt = 0
    this.open('connecting')
  }

  subscribe(symbols: readonly string[]): void {
    if (symbols.length > 0) this.send(this.subscribeMessage(symbols))
  }

  unsubscribe(symbols: readonly string[]): void {
    if (symbols.length > 0) this.send(this.unsubscribeMessage(symbols))
  }

  close(): void {
    this.closedByUser = true
    if (this.retryTimer !== null) clearTimeout(this.retryTimer)
    this.retryTimer = null
    const socket = this.socket
    this.socket = null
    if (socket) {
      socket.onopen = socket.onclose = socket.onerror = socket.onmessage = null
      socket.close()
    }
    this.handlers?.onStatus('closed')
  }

  protected send(data: string): void {
    if (this.socket?.readyState === OPEN) this.socket.send(data)
  }

  private open(status: 'connecting' | 'reconnecting'): void {
    const handlers = this.handlers
    if (!handlers) return
    handlers.onStatus(status)

    const socket = this.createSocket(this.url())
    this.socket = socket

    socket.onopen = () => {
      this.attempt = 0
      handlers.onStatus('open')
      handlers.onOpen()
    }
    socket.onmessage = (ev) => {
      const ticks = this.parse(ev.data)
      if (ticks.length > 0) handlers.onTicks(ticks)
    }
    // Browsers fire `error` then `close`; reconnect from `close` only.
    socket.onerror = () => {}
    socket.onclose = () => {
      if (this.socket !== socket || this.closedByUser) return
      this.socket = null
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect(): void {
    const delay = backoffDelay(this.attempt, this.backoff, this.random)
    this.attempt += 1
    this.handlers?.onStatus('reconnecting')
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      this.open('reconnecting')
    }, delay)
  }
}
