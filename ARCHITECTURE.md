# Architecture

`quant.term` is a browser-first React research application with two bounded workspaces: a live market monitor and a deterministic Strategy Lab. Public market and network data goes directly to the browser; the edge layer fetches and normalizes public RSS. Strategy Lab v1 uses a fixed local validation fixture. There is no account backend, secret store, remote compute service, or order-routing service.

## Runtime data flow

~~~mermaid
flowchart LR
    subgraph Sources["Public providers"]
        BS["Binance Spot"]
        BF["Binance USDⓈ-M"]
        RSS["CoinDesk + Cointelegraph RSS"]
        MP["mempool.space"]
        FG["Alternative.me"]
    end

    subgraph Edge["Edge adapters"]
        News["Shared news handler"]
        Sites["Sites / Cloudflare Worker"]
        Vercel["Vercel Function"]
    end

    subgraph Browser["React application"]
        Feeds["REST + WebSocket hooks"]
        Stores["Zustand stores"]
        Calc["Indicators + order-flow calculators"]
        UI["Terminal panels"]
        Local["localStorage"]
        Lab["Strategy Lab"]
        TSReplay["TypeScript reference replay"]
        Fixture["Deterministic BTC fixture"]
    end

    RSS --> News
    News --> Sites
    News --> Vercel
    Sites --> Feeds
    Vercel --> Feeds
    BS --> Feeds
    BF --> Feeds
    MP --> Feeds
    FG --> Feeds
    Feeds --> Stores
    Feeds --> Calc
    Stores --> UI
    Calc --> UI
    Stores <--> Local
    Fixture --> TSReplay
    TSReplay --> Lab
~~~

The separately compiled C++20 core under `engine/` implements the same bounded
SMA crossover semantics and is checked against shared golden metric values. It
is not executed by the deployed browser in v1. A native service or small-job
WebAssembly adapter requires explicit parity fixtures and benchmarks first.

## Source ownership

| Area | Responsibility |
|---|---|
| `src/app` | Application shell and workspace composition |
| `src/backtest` | Browser reference replay, validation, metrics, and deterministic fixture |
| `src/features` | Feature-owned panels and presentation |
| `src/hooks` | React lifecycle around live subscriptions |
| `src/integrations` | Provider-specific contracts, parsers, and clients |
| `src/services` | Provider-neutral telemetry and data provenance |
| `src/stores` | Shared state and persistence boundaries |
| `src/ui` | Reusable terminal primitives |
| `src/utils` | Pure calculations and formatting |
| `worker` | Shared news handler and Sites adapter |
| `api` | Vercel Function adapters |
| `engine` | Native C++20 deterministic replay core, CLI, and CTest suite |
| `schemas` | Versioned browser/native result contract |

Only active runtime code lives under `src`. Research prototypes that are not compiled, tested, or reachable do not remain in the production tree.

## Market-data paths

### Binance Spot

| Consumer | Transport | Responsibility |
|---|---|---|
| Market watch | REST seed + combined mini-ticker WebSocket | Last price, 24-hour change, and quote volume |
| Chart feed | REST klines + selected-symbol WebSocket | Historical and live candles |
| Chart heatmap | Selected-symbol depth snapshots | Bounded depth history and derived bins |
| DOM / OFI | Partial-depth WebSocket | Top-20 bid and ask snapshots |
| Volume delta / VPIN | Shared aggregate-trade WebSocket | Taker-side trade classification |

### Binance USDⓈ-M

Provider code under `src/integrations/binance` normalizes futures contract symbols and parses mark price, funding, open interest, long/short positioning, and forced-order events. These are public observations only.

### News and network

`worker/news.ts` merges, validates, sorts, and deduplicates CoinDesk and Cointelegraph RSS. `worker/index.ts` and `api/vercel-news.ts` are thin platform adapters around that shared handler. mempool.space and Alternative.me requests remain browser-side.

## Chart pipeline

~~~mermaid
sequenceDiagram
    participant REST as Binance REST
    participant WS as Binance WebSocket
    participant Feed as useChartDataFeed
    participant Store as chartDataStore
    participant Chart as TerminalChart

    Feed->>REST: Request historical klines
    REST-->>Feed: Validated candle rows
    Feed->>Store: Replace interval history
    WS-->>Feed: Live candle and depth
    Feed->>Store: Upsert latest candle
    Feed->>Store: Append bounded depth snapshot
    Store-->>Chart: Candles and heatmap bins
    Chart->>Chart: lightweight-charts series update/reload
~~~

If a live candle arrives while history is loading, the feed reapplies it after the REST response so an older snapshot cannot roll the chart backward.

## Deterministic replay pipeline

~~~mermaid
sequenceDiagram
    participant User
    participant Lab as Strategy Lab
    participant Fixture as Fixed BTC fixture
    participant Engine as Browser reference engine
    participant Result as Results and trade ledger

    User->>Lab: Configure SMA periods and costs
    User->>Lab: Run replay
    Lab->>Fixture: Load candles and checksum
    Lab->>Engine: Validate ordered OHLCV + config
    Engine->>Engine: Evaluate signal at candle close
    Engine->>Engine: Fill at next candle open
    Engine->>Result: Equity, drawdown, metrics, trades
    Result-->>User: Inspect generated evidence
~~~

Replay v1 is long/flat only. It uses full available capital, explicit taker fees,
adverse basis-point slippage, mark-to-market equity, and deterministic sequential
trade identifiers. Any open position is closed with costs on the final fixture
candle. The interface identifies the synthetic source and does not present the
result as historical model performance.

## State and persistence

| State | Responsibility | Persisted |
|---|---|---|
| `marketStore` | Selected symbol, watchlist, normalized ticker cache | Symbol and watchlist |
| `chartDataStore` | Candle series and heatmap configuration | No |
| `orderBookHistoryStore` | Bounded depth snapshots | No |
| `connectionStore` | Per-source status and measured latency | No |
| `alertStore` | Alert definitions and session triggers | Definitions only |
| `portfolioStore` | Simulated balance, initial margin, positions, P&L, and bounded history | Yes |
| Theme | Dark/light preference | Yes |

## Reliability boundaries

- WebSocket hooks clean up handlers, use stale-feed watchdogs, and reconnect with bounded exponential delay.
- REST consumers validate response shape and surface unavailable states.
- The news handler returns partial results when one publisher fails and a 502 when all publishers fail.
- Connection latency comes from exchange-message timestamps, not synthetic random values.
- Provider availability, region policy, browser scheduling, and network distance remain outside the application's control.

## Deployment boundary

`npm run build` produces:

~~~text
dist/
├── client/      # Browser assets
├── server/      # Sites / Cloudflare Worker bundle
└── .openai/     # Sites project metadata
~~~

Vercel serves `dist/client` and builds `api/vercel-news.ts` separately, rewriting the public `/api/news` route to that Function. Sites serves `dist/client` through the Worker in `dist/server`. Both expose the same `/api/news` response contract.

## Quality gates

TypeScript covers `src`, `worker`, `api`, build helpers, and Vite/Vitest configuration. CI requires zero lint warnings, strict type checking, deterministic Vitest execution, configured coverage floors, the C++20 CTest correctness suite, and a verified production build.
