import { WebSocketServer } from 'ws'
import { ClientSession } from './client'
import type { Market } from './market'
import { parseClientMessage, type RawTick, type ServerConfigMessage } from './protocol'

export type MockServerOptions = {
  market: Market
  /** 0 picks a free port; read the actual one from `MockServer.port`. */
  port: number
  /** How often tick batches are sent (ms). */
  intervalMs?: number
  /** How often the sent rate is logged (ms). */
  reportMs?: number
  log?: (line: string) => void
}

export type MockServer = {
  /** Port the server listens on (resolved when `port: 0` was passed). */
  readonly port: number
  readonly clientCount: number
  close(): Promise<void>
}

/** Skip a beat instead of queueing when a client can't keep up. */
const MAX_BUFFERED_BYTES = 4 * 1024 * 1024

/**
 * Start the mock WebSocket server. Each client gets `market.tps` ticks per
 * second, spread randomly over its own subscriptions, sent as one JSON array
 * per interval. Resolves once the server is listening.
 */
export async function createMockServer(options: MockServerOptions): Promise<MockServer> {
  const { market, intervalMs = 10, reportMs = 5000, log = console.log } = options
  const clients = new Set<ClientSession>()
  let sentSinceReport = 0

  const configMessage = (): string => {
    const msg: ServerConfigMessage = { type: 'config', tps: market.tps, symbols: [...market.symbols] }
    return JSON.stringify(msg)
  }

  const wss = new WebSocketServer({ port: options.port })
  await new Promise<void>((resolve, reject) => {
    wss.once('listening', resolve)
    wss.once('error', reject)
  })

  wss.on('connection', (socket) => {
    const client = new ClientSession(socket, performance.now())
    clients.add(client)
    socket.send(configMessage())

    socket.on('message', (data) => {
      const msg = parseClientMessage(String(data))
      if (!msg) return
      if (msg.op === 'subscribe') client.subscribe(msg.symbols, market)
      else if (msg.op === 'unsubscribe') client.unsubscribe(msg.symbols)
      else if (market.configure({ tps: msg.tps, symbols: msg.symbols })) {
        // Symbols removed by a smaller config disappear from every subscription.
        for (const c of clients) c.pruneTo(market)
        const config = configMessage()
        for (const c of clients) c.socket.send(config)
        log(`config: ${market.symbols.length} symbols · ${market.tps} ticks/s per client`)
      }
    })

    socket.on('close', () => clients.delete(client))
  })

  const sendTimer = setInterval(() => {
    const now = performance.now()
    const wallClock = Date.now()
    for (const client of clients) {
      const count = client.pacer.due(market.tps, now)
      const symbols = client.subscribed
      if (count === 0 || symbols.length === 0) continue
      if (client.socket.readyState !== client.socket.OPEN) continue
      if (client.socket.bufferedAmount > MAX_BUFFERED_BYTES) continue
      const batch: RawTick[] = new Array(count)
      for (let i = 0; i < count; i++) {
        const s = symbols[Math.floor(Math.random() * symbols.length)]!
        batch[i] = market.tick(s, wallClock)
      }
      client.socket.send(JSON.stringify(batch))
      sentSinceReport += count
    }
  }, intervalMs)

  const reportTimer = setInterval(() => {
    if (clients.size === 0) return
    const rate = Math.round((sentSinceReport * 1000) / reportMs)
    sentSinceReport = 0
    log(`sent ${rate} ticks/s to ${clients.size} client(s) · target ${market.tps}/client`)
  }, reportMs)

  const address = wss.address()
  const port = typeof address === 'object' && address !== null ? address.port : options.port

  return {
    port,
    get clientCount() {
      return clients.size
    },
    close() {
      clearInterval(sendTimer)
      clearInterval(reportTimer)
      for (const client of clients) client.socket.terminate()
      return new Promise<void>((resolve, reject) => wss.close((err) => (err ? reject(err) : resolve())))
    },
  }
}
