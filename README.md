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

## Binance source

`BinanceAdapter` (`apps/web/src/data/adapters/`) streams live spot trades from the market-data-only endpoint `wss://data-stream.binance.vision/ws`, one `<symbol>@aggTrade` stream per symbol on a single socket. Default symbols (30 liquid USDT pairs) are in `binanceSymbols.ts`.

- Subscriptions are changed over the open socket with `SUBSCRIBE` / `UNSUBSCRIBE` frames carrying increasing request ids. Error replies are logged and the rejected streams are dropped.
- Changes are coalesced: a burst of row mounts becomes one frame, and a subscribe immediately undone by an unsubscribe sends nothing.
- Binance limits: control frames are sent at most 3 per second (the server drops connections above 5 incoming messages/sec, pongs included), at most 200 streams per frame, and at most 1024 streams per connection (extra symbols are skipped with a warning).
- The 24h forced disconnect, network drops and an unresponsive socket (no data for 30 s while subscribed) all go through the shared reconnect with backoff, after which the feed resubscribes.

Aggregate trades map to ticks as `{ s: symbol, p: Number(price), t: tradeTime }`.

