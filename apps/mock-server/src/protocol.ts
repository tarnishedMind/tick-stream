import { parseJson, type ClientMessage } from '@tick-stream/protocol'

export type { ClientMessage, LoadConfig, RawTick, ServerConfigMessage } from '@tick-stream/protocol'
export { LIMITS } from '@tick-stream/protocol'

/** Validate a client frame. Anything that is not a well-formed ClientMessage gives null. */
export function parseClientMessage(raw: string): ClientMessage | null {
  const msg = parseJson(raw)
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
