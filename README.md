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

Mock server settings: `PORT`, `SYMBOLS` (number of tickers), `TPS` (ticks per second).
