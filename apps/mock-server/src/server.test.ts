import { afterEach, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import { Market } from './market'
import { createMockServer, type MockServer } from './server'

let server: MockServer | null = null
const sockets: WebSocket[] = []

afterEach(async () => {
  for (const s of sockets.splice(0)) s.terminate()
  await server?.close()
  server = null
})

async function start(config = { tps: 1000, symbols: 3 }) {
  server = await createMockServer({ market: new Market(config), port: 0, log: () => {} })
  return server
}

/** Connect a client that records every message it receives. */
async function connect(port: number) {
  const socket = new WebSocket(`ws://localhost:${port}`)
  sockets.push(socket)
  const messages: unknown[] = []
  socket.on('message', (data) => messages.push(JSON.parse(String(data))))
  await new Promise((resolve) => socket.once('open', resolve))
  return { socket, messages, send: (msg: unknown) => socket.send(JSON.stringify(msg)) }
}

async function until(check: () => boolean, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!check()) {
    if (Date.now() > deadline) throw new Error('timed out')
    await new Promise((r) => setTimeout(r, 10))
  }
}

const isConfig = (m: unknown): m is { type: 'config'; tps: number; symbols: string[] } =>
  typeof m === 'object' && m !== null && (m as { type?: unknown }).type === 'config'

describe('createMockServer', () => {
  it('sends the config on connect and ticks only for subscribed symbols', async () => {
    const { port } = await start()
    const client = await connect(port)
    await until(() => client.messages.length > 0)
    expect(client.messages[0]).toEqual({ type: 'config', tps: 1000, symbols: ['SYM0000', 'SYM0001', 'SYM0002'] })

    client.send({ op: 'subscribe', symbols: ['SYM0001', 'NOPE'] })
    await until(() => client.messages.some(Array.isArray))
    const ticks = client.messages.filter(Array.isArray).flat() as { s: string }[]
    expect(new Set(ticks.map((t) => t.s))).toEqual(new Set(['SYM0001']))
  })

  it('broadcasts config changes to every client', async () => {
    const { port } = await start()
    const a = await connect(port)
    const b = await connect(port)
    a.send({ op: 'config', tps: 50, symbols: 2 })
    await until(() => b.messages.filter(isConfig).length === 2)
    expect(b.messages.filter(isConfig).at(-1)).toEqual({ type: 'config', tps: 50, symbols: ['SYM0000', 'SYM0001'] })
  })

  it('tracks connected clients and refuses connections after close()', async () => {
    const srv = await start()
    await connect(srv.port)
    await until(() => srv.clientCount === 1)
    await srv.close()
    server = null
    const late = new WebSocket(`ws://localhost:${srv.port}`)
    await expect(new Promise((_, reject) => late.once('error', reject))).rejects.toThrow()
  })
})
