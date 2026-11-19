/**
 * Wire protocol between the mock server (apps/mock-server) and the web app's
 * MockAdapter, plus the normalized tick format every adapter produces.
 * Types only and a few constants: both apps import this package directly.
 *
 * Server → client:
 *   - RawTick[]            a batch of ticks (arrays are always tick batches)
 *   - ServerConfigMessage  current load settings and symbol list; sent on
 *                          connect and broadcast after every config change
 *
 * Client → server: ClientMessage.
 */

/** Normalized tick: symbol, price, exchange timestamp (ms). */
export type RawTick = { s: string; p: number; t: number }

export type LoadConfig = {
  /** Ticks per second sent to each client, spread over its subscribed symbols. */
  tps: number
  /** Number of symbols the server simulates. */
  symbols: number
}

/** Load settings as the server reports them: the rate and the full symbol list. */
export type ServerConfig = { tps: number; symbols: string[] }

export type ServerConfigMessage = { type: 'config' } & ServerConfig

export type ClientMessage =
  | { op: 'subscribe'; symbols: string[] }
  | { op: 'unsubscribe'; symbols: string[] }
  | { op: 'config'; tps?: number; symbols?: number }

/** Bounds the server clamps a `config` request to. */
export const LIMITS = {
  tps: { min: 0, max: 200_000 },
  symbols: { min: 1, max: 10_000 },
} as const

/** Parse one text frame as JSON. Non-string frames and invalid JSON give `undefined`. */
export function parseJson(data: unknown): unknown {
  if (typeof data !== 'string') return undefined
  try {
    return JSON.parse(data) as unknown
  } catch {
    return undefined
  }
}
