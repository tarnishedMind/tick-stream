import type { FrameScheduler } from './QuoteFeed'
import type { Adapter, AdapterHandlers, RawTick } from './types'
import type { SocketLike } from './WsAdapter'

/** Frame scheduler driven by hand: `runFrame()` plays the role of the browser painting a frame. */
export class ManualFrames implements FrameScheduler {
  private next = 1
  private readonly pending = new Map<number, () => void>()

  request(cb: () => void): number {
    const id = this.next++
    this.pending.set(id, cb)
    return id
  }

  cancel(handle: number): void {
    this.pending.delete(handle)
  }

  get size(): number {
    return this.pending.size
  }

  runFrame(): void {
    const callbacks = [...this.pending.values()]
    this.pending.clear()
    for (const cb of callbacks) cb()
  }
}

/** Adapter double that records calls and lets a test push ticks or open the "connection". */
export class FakeAdapter implements Adapter {
  readonly name = 'fake'
  handlers: AdapterHandlers | null = null
  readonly subscribed: string[][] = []
  readonly unsubscribed: string[][] = []
  closed = false

  connect(handlers: AdapterHandlers): void {
    this.handlers = handlers
    handlers.onStatus('connecting')
  }
  subscribe(symbols: readonly string[]): void {
    this.subscribed.push([...symbols])
  }
  unsubscribe(symbols: readonly string[]): void {
    this.unsubscribed.push([...symbols])
  }
  close(): void {
    this.closed = true
  }

  open(): void {
    this.handlers?.onStatus('open')
    this.handlers?.onOpen()
  }
  emit(...ticks: RawTick[]): void {
    this.handlers?.onTicks(ticks)
  }
}

/** In-memory WebSocket stand-in. */
export class FakeSocket implements SocketLike {
  static instances: FakeSocket[] = []
  readyState = 0
  onopen: ((ev: unknown) => void) | null = null
  onclose: ((ev: unknown) => void) | null = null
  onerror: ((ev: unknown) => void) | null = null
  onmessage: ((ev: { data: unknown }) => void) | null = null
  readonly sent: string[] = []
  closeCalls = 0

  constructor(readonly url: string) {
    FakeSocket.instances.push(this)
  }

  send(data: string): void {
    this.sent.push(data)
  }
  close(): void {
    this.closeCalls += 1
    this.readyState = 3
  }

  serverOpen(): void {
    this.readyState = 1
    this.onopen?.({})
  }
  serverMessage(data: unknown): void {
    this.onmessage?.({ data })
  }
  serverDrop(): void {
    this.readyState = 3
    this.onerror?.({})
    this.onclose?.({})
  }
}
