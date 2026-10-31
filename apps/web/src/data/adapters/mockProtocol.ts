/**
 * Client-side copy of the mock server's wire protocol
 * (apps/mock-server/src/protocol.ts). Keep the two in sync.
 */
export type MockServerConfig = { tps: number; symbols: string[] }

export type MockServerConfigMessage = { type: 'config' } & MockServerConfig

export type MockClientMessage =
  | { op: 'subscribe'; symbols: string[] }
  | { op: 'unsubscribe'; symbols: string[] }
  | { op: 'config'; tps?: number; symbols?: number }
