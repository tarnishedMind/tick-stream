# TickStream — MVP milestones (phase 1)

## MVP definition

The MVP proves the core claim of the project: **the quotes table stays at ~60 fps under a fast realtime stream**, with a live exchange feed and a synthetic load generator behind the same data pipeline, and UI controls to switch source, dial the load and see the FPS.

**In scope:** shared data layer (feed, store, `useQuote`), adapter interface, Mock and Binance adapters, configurable mock server, virtualized quotes table with price flash, control panel (source switch, ticks/sec slider, FPS counter), feed tests, README with measured numbers.

**Out of scope (phase 2):** Lightweight Charts, Web Worker parsing and MessagePack/Protobuf, Coinbase and Finnhub adapters, `@depth` stress mode, AG Grid comparison, deployment.

Starting point: pnpm monorepo with an empty `apps/web` (React 19 + Vite + TS) and `apps/mock-server` (ws random walk with `SYMBOLS` / `TPS` env vars), Node 22.

---

## M1. Data core

**Goal:** a source-agnostic data pipeline that works without any UI.

**Scope**
- Port `quotes.ts` and `QuoteRow.tsx` into `apps/web/src/data/` and `apps/web/src/components/`.
- Extract the `Adapter` interface: `connect()`, `subscribe(symbols)`, `unsubscribe(symbols)`, `close()`, plus an `onTick(RawTick)` / status callback. `RawTick { s, p, t }` lives in one shared types file.
- `QuoteFeed`: latest-wins `Map` buffer with timestamp check, rAF flush (one batch per frame), ref-counted subscriptions, reconnect with exponential backoff + jitter, resubscribe from `refCounts` in `onopen`.
- `QuoteStore` outside React with per-symbol listeners; `useQuote(symbol)` on `useSyncExternalStore`.
- Unit tests (Vitest): mock WebSocket + fake timers / stubbed rAF.

**Done when**
- Tests cover: latest-wins and out-of-order ticks dropped (buffer and store), one flush per frame, only listeners of changed symbols are notified, ref counting (two subscribers → one server subscription; last unsubscribe → server unsubscribe), reconnect backoff and resubscribe after reconnect.
- `pnpm -r test` and `pnpm -r typecheck` pass.
- Nothing in `data/` imports an exchange-specific type.

## M2. Mock source end to end

**Goal:** the synthetic generator drives the pipeline, and its load can be changed at runtime.

**Scope**
- Mock server: protocol messages `subscribe` / `unsubscribe` and `config { tps, symbols }` so the client can change the load without a restart; env vars remain the defaults.
- Server sends ticks in small batches per interval so high TPS (10k+) doesn't depend on per-message timers.
- `MockAdapter` in `apps/web` speaking that protocol.
- Root script `pnpm dev` runs web and mock server together.

**Done when**
- `pnpm dev` starts both apps; a debug view shows prices updating for N mock symbols.
- Changing `tps` over the socket takes effect within a second, verified at 100, 1k and 10k TPS (server logs actual sent rate).
- Killing and restarting the mock server: client reconnects and resubscribes without a page reload.

## M3. Binance adapter

**Goal:** the same pipeline on real market data.

**Scope**
- `BinanceAdapter` on `wss://data-stream.binance.vision`, `@aggTrade` streams, SUBSCRIBE / UNSUBSCRIBE over the open socket with request ids.
- Mapping `aggTrade` → `RawTick` (symbol, price as number, trade time).
- Default symbol list (~20–50 liquid USDT pairs) in config.
- Handle Binance limits: messages per second on control frames, max streams per connection, 24h forced disconnect (covered by reconnect).

**Done when**
- Switching to Binance shows live prices for the default list within a few seconds.
- Adapter has a unit test for message mapping and subscribe/unsubscribe frames.
- A forced disconnect (devtools offline toggle) recovers with resubscription.

## M4. Quotes table and control panel

**Goal:** the user-facing demo: a big table that stays smooth, with load controls.

**Scope**
- Quotes table on TanStack Table + TanStack Virtual; each row is the memoized `QuoteRow` bound via `useQuote`, price flash via `el.animate()`.
- Columns: symbol, last price, change vs first seen price, last update time.
- Control panel:
  - Source switch Mock / Binance (tears down one adapter, brings up the other, table resubscribes).
  - Ticks/sec slider (mock only; disabled for Binance) and symbol-count input.
  - FPS counter (rAF-based, rolling 1 s window) plus actual ticks/sec received.

**Done when**
- 1000 mock symbols scroll smoothly; only visible rows are mounted and subscribed.
- React DevTools profiler shows only rows of changed symbols re-rendering on a flush.
- Slider changes are reflected in the "received ticks/sec" readout.
- Source switch works repeatedly without leaking sockets (one open WS in the Network tab).

## M5. Performance proof and README

**Goal:** turn "it's fast" into numbers a reviewer can reproduce.

**Scope**
- Short benchmark procedure: fixed scenarios (e.g. 200 symbols × 1k TPS, 1000 × 10k, 1000 × 50k) in production build.
- Record FPS, long tasks and main-thread time from a Chrome Performance trace for each scenario.
- README in English: what the project demonstrates, architecture diagram of the data path, how to run, benchmark table, phase 2 roadmap.

**Done when**
- Target met (proposed): median FPS ≥ 58 at 1000 symbols × 10k TPS on the dev machine, production build, Chrome.
- If the 50k scenario drops frames, the README says so and points to phase 2 (Web Worker parsing) as the fix.
- A fresh clone runs with `pnpm i && pnpm dev` following only the README.

---

## Order and dependencies

M1 → M2 → M4 is the critical path (M4 needs a high-load source to be meaningful). M3 depends only on M1 and can be done in parallel with M2 or after M4. M5 closes the phase.

## Open questions

- `quotes.ts` and `QuoteRow.tsx` are not in the repo yet. M1 assumes they are added; otherwise M1 includes writing them from the brief's architecture.
- Final name (TickStream vs Firehose) and GitHub repo creation are not blocking, but should be settled before M5 (README, links).
