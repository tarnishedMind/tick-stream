import { Market } from './market'
import { createMockServer } from './server'

const market = new Market({
  tps: Number(process.env.TPS ?? 1000),
  symbols: Number(process.env.SYMBOLS ?? 50),
})

const server = await createMockServer({ market, port: Number(process.env.PORT ?? 8080) })

console.log(
  `mock-server: ws://localhost:${server.port} · ${market.symbols.length} symbols · ${market.tps} ticks/s per client`,
)
