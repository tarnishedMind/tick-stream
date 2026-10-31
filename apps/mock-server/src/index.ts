import { WebSocketServer } from 'ws'

// Same shape the web app's adapters normalize to: symbol, price, timestamp.
type RawTick = { s: string; p: number; t: number }

const PORT = Number(process.env.PORT ?? 8080)
const SYMBOLS = Number(process.env.SYMBOLS ?? 50)
const TPS = Number(process.env.TPS ?? 1000)

const prices = new Map<string, number>()
for (let i = 0; i < SYMBOLS; i++) prices.set(`SYM${i}`, 100)
const symbols = [...prices.keys()]

function nextTick(): RawTick {
  const s = symbols[Math.floor(Math.random() * symbols.length)]!
  const p = Math.max(0.01, prices.get(s)! * (1 + (Math.random() - 0.5) * 0.002))
  prices.set(s, p)
  return { s, p: Number(p.toFixed(4)), t: Date.now() }
}

const wss = new WebSocketServer({ port: PORT })

// Batch per 10 ms interval so high TPS doesn't mean one setTimeout per tick.
const INTERVAL_MS = 10
setInterval(() => {
  if (wss.clients.size === 0) return
  const count = Math.max(1, Math.round((TPS * INTERVAL_MS) / 1000))
  const batch = JSON.stringify(Array.from({ length: count }, nextTick))
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(batch)
  }
}, INTERVAL_MS)

console.log(`mock-server: ws://localhost:${PORT} · ${SYMBOLS} symbols · ${TPS} ticks/s`)
