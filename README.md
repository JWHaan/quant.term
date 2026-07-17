<div align="center">

<img src="public/quant_term_logo.svg" alt="quant.term" width="72" height="72" />

# quant.term

**A Bloomberg-inspired crypto market dashboard for live research, local alerts, and paper trading.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7.2-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e)](LICENSE)
[![CI](https://github.com/JWHaan/quant.term/actions/workflows/ci.yml/badge.svg)](https://github.com/JWHaan/quant.term/actions)

**[Live Demo →](https://quant-term.vercel.app)**

</div>

## What it is

`quant.term` is a client-side React terminal for monitoring public crypto-market data. Its primary chart is a custom D3-scaled Canvas renderer fed by Binance Spot candles, trades, and depth. Supporting panels add Binance USDⓈ-M perpetual metrics and liquidations, public news, Bitcoin network conditions, browser-local alerts, and simulated positions.

The main dashboard needs no API keys and has no trade-execution backend.

## Current capabilities

- Live Binance Spot watchlist, trades, candles, and top-of-book depth
- Historical Spot candles with 1m, 5m, 15m, 1h, 4h, and 1d chart intervals
- Custom Canvas chart with D3 scales, zoom/pan, EMA overlays, RSI, MACD, and a depth heatmap
- Binance USDⓈ-M mark/index price, funding, open interest, long/short accounts, and liquidation stream
- Public CryptoCompare news with a short in-memory cache
- Bitcoin block height, mempool backlog, recommended fees, and Fear & Greed from public endpoints
- Local price alerts with optional browser notifications while the terminal is open
- Simulated LONG/SHORT paper positions with unrealized and realized P&L
- Experimental order-flow and statistical analytics: OFI, volume delta/CVD, VPIN, Hurst exponent, ADX, ATR, RSI, MACD, OBV, VWAP, and heuristic factor scores
- Resizable desktop layout, command palette, keyboard shortcuts, and dark/light themes

Experimental analytics are descriptive research aids. They are not a predictive model, execution signal, or investment advice.

## Public data sources

| Source | Used for | Access |
|---|---|---|
| Binance Spot REST/WebSocket | Watchlist, candles, trades, depth | Public, read-only |
| Binance USDⓈ-M REST/WebSocket | Perpetual metrics and liquidations | Public, read-only |
| CryptoCompare | Market news | Public endpoint |
| mempool.space | Bitcoin height, mempool, and fees | Public endpoint |
| Alternative.me | Fear & Greed index | Public endpoint |

Provider availability, browser network policy, regional restrictions, VPNs, and ad blockers can affect individual panels. A failed auxiliary source does not fabricate replacement data.

## Getting started

### Requirements

- Node.js 20.19+ or 22.12+
- A current desktop browser

### Run locally

```bash
git clone https://github.com/JWHaan/quant.term.git
cd quant.term
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No `.env` file is required for the main dashboard.

### Verify and build

```bash
npm run lint
npm run type-check
npm run test -- --run
npm run build
npm run preview
```

| Command | Purpose |
|---|---|
| `npm run dev` | Start Vite with hot reload |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Run strict TypeScript checks |
| `npm run test -- --run` | Run the Vitest suite once |
| `npm run test:coverage` | Run tests and enforce configured coverage thresholds |
| `npm run build` | Type-check and create the production bundle |
| `npm run preview` | Serve the production bundle locally |

## Local state and privacy

All application state stays in the browser. The following values persist in `localStorage`:

- selected symbol and watchlist
- theme preference
- alert definitions; triggered state and alert history are session-only
- paper starting balance, realized P&L, open positions, and up to 250 closed trades
- experimental model metadata if the dormant quant store is used

Live market data, chart buffers, depth history, connection status, news cache, and network snapshots remain in memory and are cleared on reload.

Paper trades are simulations. No exchange credentials are accepted, no orders are sent, and no real funds are involved.

## Project layout

```text
src/
├── components/      # Custom D3/Canvas chart
├── features/        # Market, research, news, alerts, and paper-trading panels
├── hooks/           # Live feeds, chart orchestration, telemetry, shortcuts
├── services/        # Active public clients plus isolated experimental scaffolds
├── stores/          # Zustand state and bounded market buffers
├── ui/              # Terminal layout and reusable UI
├── utils/           # Indicators and order-flow calculations
└── tests/           # Vitest unit and regression tests
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the runtime data flow and persistence model.

## Scope boundaries

The current site does not provide:

- live order placement, exchange accounts, wallets, or custody
- an economic calendar or authenticated on-chain analytics API
- Deribit or multi-exchange aggregation in the active dashboard
- production ML forecasts, portfolio VaR/Greeks, or backtesting
- guaranteed institutional latency, uptime, or data completeness

Some repository files explore these directions but are intentionally excluded from the active product until their dependencies, data contracts, and tests are ready.

## Deployment

The repository includes Vercel and Docker configuration. Vercel serves the static Vite bundle and SPA fallback; all market requests still originate from each visitor's browser.

## Contributing

Pull requests are welcome. Run lint, type-check, tests, and the production build before submitting. Financial-calculation changes should include focused regression tests.

## Acknowledgements

- [D3](https://d3js.org/) — chart scales and interaction utilities
- [Binance](https://developers.binance.com/) — public Spot and USDⓈ-M market data
- [CryptoCompare](https://www.cryptocompare.com/) — public crypto news
- [mempool.space](https://mempool.space/) — Bitcoin network data
- [Alternative.me](https://alternative.me/crypto/fear-and-greed-index/) — Fear & Greed index
- Bloomberg Terminal — interface inspiration

---

<div align="center">

MIT License · Public market data · Simulated trading · **Not financial advice**

</div>
