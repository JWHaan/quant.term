# Architecture

`quant.term` is a browser-first crypto research terminal. The whole interactive
application is Rust compiled to WebAssembly: the `quant-ui` Leptos crate
renders the terminal, and the `quant-core` crate supplies indicators,
order-flow calculations, and the deterministic backtest engine. TypeScript
remains as a thin build shell — the Vite entry point, committed wasm-bindgen
bundles, a kept reference implementation, and the parity test harness — plus
the two edge news adapters.

## Runtime data flow

~~~mermaid
flowchart LR
    subgraph Sources
        SPOT[Binance Spot REST + WebSocket]
        FUT[Binance USDⓈ-M REST + WebSocket]
        RSS[CoinDesk + Cointelegraph RSS]
        NET[mempool.space + Alternative.me]
    end

    subgraph Edge
        NEWS[Shared news handler]
    end

    subgraph Browser["Browser · Leptos/WASM app"]
        FEEDS[services: binance_feed, rest, news]
        STORES[stores: signal stores]
        CORE[quant-core: indicators, order flow, replay]
        PANELS[features: monitor panels + Strategy Lab]
    end

    SPOT --> FEEDS
    FUT --> FEEDS
    NET --> STORES
    RSS --> NEWS --> FEEDS
    FEEDS --> STORES --> PANELS
    STORES --> CORE
    CORE --> PANELS
~~~

## Source ownership

| Area | Files | Role |
|---|---|---|
| Frontend | `ui/src/app`, `ui/src/features`, `ui/src/ui` | Leptos workspace composition, Monitor/Strategy Lab panels, terminal chrome |
| Client state | `ui/src/stores` | `AppStores` signal graph (the Zustand equivalent), provider parsing, symbol normalization |
| Browser runtime | `ui/src/services` | `binance_feed` WebSocket orchestration, `rest`/`news` fetch, telemetry, provenance |
| Engine | `rust/` | `quant-core`: indicators, trade classification, VPIN/OFI/heatmap, SMA replay |
| Entry + bindings | `src/rust-main.ts`, `src/wasm` | Vite entry; committed wasm-bindgen bundles for both crates |
| TS reference | `src/utils`, `src/backtest` | Wasm adapters plus kept TypeScript reference implementations for parity tests |
| Edge runtime | `worker/`, `api/vercel-news.ts` | Shared `/api/news` handler for Sites/Cloudflare and Vercel |
| Contracts | `schemas/`, `src/backtest` | `backtest-v1` versioned JSON contract |
| Build/deploy | `build/`, `scripts/`, `vite.config.ts`, `wrangler.jsonc`, `vercel.json` | One build for browser + edge deployment |

The browser calls public market-data providers directly. The edge layer only
exists to normalize public RSS feeds through a same-origin endpoint with
explicit `Cache-Control` behavior.

## Module relationships (frontend)

The Leptos crate mirrors the original TypeScript module boundaries:

- `ui/src/app` composes the root `App`, workspace selection (Monitor /
  Strategy Lab), theme, global keyboard shortcuts, command palette, and
  mobile gate.
- `ui/src/stores` provides `AppStores` via Leptos context — signals for
  selected symbol, watchlist, market data, candles, order-book snapshots,
  paper portfolio, alerts, and connection status. Components read them via
  `use_stores()`.
- `ui/src/services/binance_feed` owns Spot and futures WebSocket lifecycle:
  stream normalization, batching, heartbeat, reconnect backoff, and fan-out
  into stores. `services/rest` handles one-shot REST reads; `services/news`
  polls `/api/news`. `provenance` and `telemetry` are pure logic compiled for
  both host and wasm targets.
- `ui/src/features` holds the workspace panels — market grid, chart,
  microstructure ribbon, order book/DOM, liquidation feed, quant signal and
  alpha panels, news, network pulse, alerts, paper trading — plus the
  `StrategyLab` workspace and the command palette.
- `ui/src/ui` is presentation-only chrome: `DashboardPanel`, tab panels,
  resize handles, header/footer, command line, help modal.

Two-way dependencies are avoided: services feed stores, features read stores
and call `quant-core`, chrome receives derived props.

## quant-core

`rust/` is a `cdylib` + `rlib` crate consumed in two ways:

1. as a native path dependency of `quant-ui` (the Leptos app calls it
   directly), and
2. as a wasm-bindgen bundle under `src/wasm/quant-core`, consumed by the
   TypeScript adapters and parity tests.

It exports SMA/EMA/RSI/MACD/Bollinger/ATR/ADX/VWAP/OBV/Hurst/OFI indicator
functions, order-flow calculators (trade classification, VPIN, book pressure,
heatmap), and the `run_sma_cross_backtest` /
`validate_backtest_input_js` replay entry points. Inputs are validated
defensively — malformed or non-finite provider payloads produce bounded empty
or neutral outputs, not fabricated values.

The generated bundles in `src/wasm/` are committed so installs, CI, and
deployments do not need a Rust toolchain. Rebuild them with
`npm run wasm:build` (core) and `./scripts/build-ui-wasm.sh` (UI) after
editing the crates. `npm run wasm:check` runs `cargo fmt --check` and
`cargo clippy -D warnings` on `quant-core`.

## Market-data paths

| Path | Source | Consumers | Failure behavior |
|---|---|---|---|
| REST snapshots | Binance Spot + USDⓈ-M public REST | stores, chart history, depth bootstrap | Logged or visible status; never hidden with mock values |
| Live streams | Spot/futures public WebSocket streams | stores, ticks, depth, liquidations | Reconnect with bounded retries and stale-state display |
| News | Same-origin `/api/news` | `services/news` → news panels | `502` or explicit source-state payload keeps panel unavailable |
| Network panels | mempool.space, Alternative.me | Network Pulse + Fear & Greed panels | Failed polls show unavailable state |
| Replay datasets | Bundled fixture or Binance Spot klines | Strategy Lab via `quant-core` | Explicit unavailable states for missing upstream data |

Provider payloads are parsed at store/service boundaries. Invalid numbers
are rejected instead of replaced with fabricated values.

## Chart and microstructure rendering

The chart is a custom Canvas2D renderer
(`ui/src/features/charts/canvas_chart.rs`) — candles, a volume pane, EMA
overlays, native RSI and MACD panes, crosshair, and theme-aware frame —
because `lightweight-charts` has no wasm equivalent. Store candle history and
order-book snapshots feed the chart, the depth-heatmap strip, and the
microstructure ribbon.

## Deterministic replay pipeline

~~~mermaid
flowchart TD
    LAB[Strategy Lab] -->|validates config| V[validate_backtest_input]
    LAB -->|bundled fixture or Binance klines| DS[BacktestDataset]
    V --> RUN[run_sma_cross_backtest]
    DS --> RUN
    RUN -->|next-bar fills, fees, adverse slippage| RES[BacktestResult]
    RES --> UI[equity, drawdown, trade ledger, provenance]

    subgraph Gate
        PAR[src/tests: wasm ↔ TS reference parity]
        SCH[schema tests: backtest-v1 contract]
    end

    RUN -.checked by.-> PAR
    RES -.shape checked by.-> SCH
~~~

The Strategy Lab fetches Binance Spot klines through `services/rest` (or the
bundled fixture) and runs the same `quant-core` engine the rest of the app
links against — no remote jobs, no server. `src/backtest/engine.ts` is a thin
wasm adapter kept so the Vitest suite can compare the Rust engine against the
independent TypeScript reference in `engine-reference.ts` on identical input,
and so the `backtest-v1` schema and fixture tests retain a consumer. The
former C++ engine and its native CI job were removed when the engine moved
into `quant-core`.

## State and persistence

Browser persistence is intentionally narrow:

| Area | Mechanism | Data | Persistence |
|---|---|---|---|
| Workspace + theme | `localStorage` | workspace mode, `theme` | Persisted |
| Market state | `localStorage` under `market-store` | selected symbol + watchlist | Persisted |
| Chart/depth history | signals in memory | bounded candle + snapshot buffers | Session only |
| Paper trading | `localStorage` under `quant-term-paper-portfolio` | balance, positions, realized P&L, trades | Persisted simulation |
| Alerts | `localStorage` under `alert-store` | alert definitions | Persisted; trigger history session-only |
| Connection | signals | provider status, latency, heartbeat | Session only |
| News/network | `localStorage` + fetch cache | bounded summaries | Session only |

`quant.term` does not own market data. It renders bounded, validated views of
public provider payloads.

## Reliability and observability

- Bounded buffers: live stores cap candles, trades, order-book history, news,
  telemetry, and alert history.
- Provider boundaries: network adapters validate payloads before reaching
  features; malformed provider data becomes unavailable state, not mock data.
- Reconnect policy: market sockets reconnect with bounded retries and explicit
  stale/disconnected statuses.
- Honest metrics: replay provenance describes the dataset window, checksum,
  gap count, fees, slippage, execution rule, and engine; replay results are
  never presented as realized performance.

## Deployment boundary

`vite build` emits a static `dist/client`, a Worker bundle under
`dist/server`, and `.openai` metadata. The Vercel deployment consumes
`dist/client` and maps `/api/news` to `api/vercel-news.ts`. No production
environment variables are required.

## Quality gates

CI enforces `npm run lint`, `npm run type-check`, `npm run test:coverage`,
and `npm run build`. The Vitest suite covers the wasm↔TS parity for
indicators and the replay engine, the `backtest-v1` contract, edge adapters,
and shared utilities. `npm run wasm:check` (cargo fmt + clippy on
`quant-core`) is the Rust gate and should run alongside `npm run check` when
editing `rust/` or `ui/`.
