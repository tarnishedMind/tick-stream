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


## Quotes table and control panel

The web app is one screen: a control panel above a virtualized quotes table.

- **Table** (`apps/web/src/components/QuoteTable.tsx`): TanStack Table defines the columns (symbol, last price, change vs the first price seen this session, last update time); TanStack Virtual mounts only the rows in and around the viewport (fixed 28 px rows). Each mounted `QuoteRow` subscribes its symbol through `useQuote` and releases it on unmount, so the feed only subscribes visible rows. Rows are memoized on the TanStack row object and re-render only when their own quote changes. The price flash runs on `el.animate()`, outside React state.
- **Source switch**: Mock / Binance. The feed closes the current adapter before connecting the next one, and the table remounts against the new symbol list, so there is one data socket at a time.
- **Ticks/sec slider** (mock only) and **symbol count**: sent to the mock server as a `config` message. For Binance the count picks the first N of the default symbols.
- **Readouts**: FPS (frames counted on `requestAnimationFrame`, rolling 1 s window), received ticks/sec (every tick the adapter delivers, same window) and the number of subscribed rows. They are measured every frame and displayed 4 times a second.

To try 1000 symbols, start the mock server with `SYMBOLS=1000` or type 1000 into the symbol count.
