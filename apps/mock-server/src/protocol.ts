/**
 * Wire protocol between the mock server and the web app's MockAdapter.
 * The web app keeps its own copy of these types (apps/web/src/data/adapters/mockProtocol.ts);
 * keep the two in sync.
 *
 * Server → client:
 *   - RawTick[]            a batch of ticks (arrays are always tick batches)
 *   - ServerConfigMessage  current load settings and symbol list; sent on
 *                          connect and broadcast after every config change
 *
 * Client → server: ClientMessage.
 */

export type RawTick = { s: string; p: number; t: number }

export type LoadConfig = {
  /** Ticks per second sent to each client, spread over its subscribed symbols. */
  tps: number
  /** Number of symbols the server simulates. */
  symbols: number
}

export type ServerConfigMessage = { type: 'config'; tps: number; symbols: string[] }

export type ClientMessage =
  | { op: 'subscribe'; symbols: string[] }
  | { op: 'unsubscribe'; symbols: string[] }
  | { op: 'config'; tps?: number; symbols?: number }

export const LIMITS = {
  tps: { min: 0, max: 200_000 },
  symbols: { min: 1, max: 10_000 },
} as const

export function parseClientMessage(raw: string): ClientMessage | null {
  let msg: unknown
  try {
    msg = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof msg !== 'object' || msg === null) return null
  const m = msg as Record<string, unknown>
  if ((m.op === 'subscribe' || m.op === 'unsubscribe') && isStringArray(m.symbols)) {
    return { op: m.op, symbols: m.symbols }
  }
  if (m.op === 'config') {
    const out: ClientMessage = { op: 'config' }
    if (isFiniteNumber(m.tps)) out.tps = m.tps
    if (isFiniteNumber(m.symbols)) out.symbols = m.symbols
    return out
  }
  return null
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string')
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}
