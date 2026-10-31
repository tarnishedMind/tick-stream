import { WebSocketServer, type WebSocket } from 'ws'
import { Market, TickPacer } from './market'
import { parseClientMessage, type RawTick, type ServerConfigMessage } from './protocol'

const PORT = Number(process.env.PORT ?? 8080)
const INTERVAL_MS = 10
const REPORT_MS = 5000

const market = new Market({
  tps: Number(process.env.TPS ?? 1000),
  symbols: Number(process.env.SYMBOLS ?? 50),
})

type Client = { socket: WebSocket; subscribed: string[]; pacer: TickPacer }
const clients = new Set<Client>()
let sentSinceReport = 0

function configMessage(): string {
  const msg: ServerConfigMessage = { type: 'config', tps: market.tps, symbols: [...market.symbols] }
  return JSON.stringify(msg)
}

function subscribe(client: Client, symbols: string[]): void {
  const set = new Set(client.subscribed)
  for (const s of symbols) if (market.has(s)) set.add(s)
  client.subscribed = [...set]
}

function unsubscribe(client: Client, symbols: string[]): void {
  const drop = new Set(symbols)
  client.subscribed = client.subscribed.filter((s) => !drop.has(s))
}

const wss = new WebSocketServer({ port: PORT })

wss.on('connection', (socket) => {
  const client: Client = { socket, subscribed: [], pacer: new TickPacer(performance.now()) }
  clients.add(client)
  socket.send(configMessage())

  socket.on('message', (data) => {
    const msg = parseClientMessage(String(data))
    if (!msg) return
    if (msg.op === 'subscribe') subscribe(client, msg.symbols)
    else if (msg.op === 'unsubscribe') unsubscribe(client, msg.symbols)
    else if (market.configure({ tps: msg.tps, symbols: msg.symbols })) {
      // Symbols removed by a smaller config disappear from every subscription.
      for (const c of clients) c.subscribed = c.subscribed.filter((s) => market.has(s))
      const config = configMessage()
      for (const c of clients) c.socket.send(config)
      console.log(`config: ${market.symbols.length} symbols · ${market.tps} ticks/s per client`)
    }
  })

  socket.on('close', () => clients.delete(client))
})

// Each client gets `tps` ticks per second, spread randomly over its own
// subscriptions, sent as one JSON array per interval.
setInterval(() => {
  const now = performance.now()
  const wallClock = Date.now()
  for (const client of clients) {
    const count = client.pacer.due(market.tps, now)
    if (count === 0 || client.subscribed.length === 0) continue
    if (client.socket.readyState !== client.socket.OPEN) continue
    // Skip a beat instead of queueing when the client can't keep up.
    if (client.socket.bufferedAmount > 4 * 1024 * 1024) continue
    const batch: RawTick[] = new Array(count)
    for (let i = 0; i < count; i++) {
      const s = client.subscribed[Math.floor(Math.random() * client.subscribed.length)]!
      batch[i] = market.tick(s, wallClock)
    }
    client.socket.send(JSON.stringify(batch))
    sentSinceReport += count
  }
}, INTERVAL_MS)

setInterval(() => {
  if (clients.size === 0) return
  const rate = Math.round((sentSinceReport * 1000) / REPORT_MS)
  sentSinceReport = 0
  console.log(`sent ${rate} ticks/s to ${clients.size} client(s) · target ${market.tps}/client`)
}, REPORT_MS)

console.log(`mock-server: ws://localhost:${PORT} · ${market.symbols.length} symbols · ${market.tps} ticks/s per client`)
