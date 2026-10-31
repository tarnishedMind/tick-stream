# TickStream

A real-time quotes frontend that holds 60 fps under very fast streaming updates.
Working title (fallback: Firehose).

## Structure

- `apps/web` — React + TypeScript + Vite: quotes table, charts, load control panel.
- `apps/mock-server` — Node + ws: synthetic tick generator (random-walk prices).

## Getting started

```bash
nvm use        # Node 22
pnpm install
pnpm dev       # web on :5173, mock-server on ws://localhost:8080
```

Run tests with `pnpm test`.

## Mock server

Env defaults: `PORT` (8080), `SYMBOLS` (number of simulated tickers, 50), `TPS` (ticks per second per client, 1000).
Load can be changed at runtime over the socket (see `apps/mock-server/src/protocol.ts`):

- client → server: `{ "op": "subscribe" | "unsubscribe", "symbols": [...] }`, `{ "op": "config", "tps"?: n, "symbols"?: n }`
- server → client: tick batches as `[{ "s", "p", "t" }, ...]`, and `{ "type": "config", "tps", "symbols": [...] }` on connect and after every change

Each client receives `TPS` ticks per second spread over the symbols it subscribed to. The server logs the actual sent rate every 5 seconds.
