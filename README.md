<div align="center">

<img src="public/favicon.svg" alt="quant.term" width="72" height="72" />

# quant.term

**A professional-grade quantitative trading terminal for crypto markets.**  
Real-time order flow, institutional analytics, and a Bloomberg-inspired interface — all in the browser, entirely free.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e)](LICENSE)
[![CI](https://github.com/JWHaan/quant.term/actions/workflows/ci.yml/badge.svg)](https://github.com/JWHaan/quant.term/actions)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FJWHaan%2Fquant.term)

**[Live Demo →](https://quant-term.vercel.app)**

</div>

---

## Overview

`quant.term` brings institutional-grade market analysis tools to an open-source, browser-based terminal. It connects directly to Binance Futures and Deribit via WebSocket — no intermediary servers, no API keys required — and exposes quantitative signals (OFI, VPIN, CVD) that are typically locked behind Bloomberg Terminal's $2,000/month subscription.

```
Stack: React 19 · TypeScript 5.7 · Vite 6 · Zustand · TradingView Lightweight Charts
Data:  Binance Futures WebSocket · Deribit API · CryptoPanic News Feed
Deploy: Vercel (one-click) · Docker
```

---

## Features

### 📊 Real-Time Market Data
- Sub-50ms tick-to-chart latency via direct WebSocket streams
- Live order book depth (DOM) with imbalance visualisation
- Multi-asset watchlist with drag-and-drop reordering
- Liquidation feed across major exchanges

### 📈 Advanced Charting
- **TradingView Lightweight Charts** — 60fps, 43KB bundle
- Full indicator suite: RSI, MACD, Bollinger Bands, EMA/SMA, Volume Profile, VWAP
- 9 timeframes (1m – 1M), keyboard-navigable

### 🧮 Quantitative Analytics

| Signal | Description | Typical source |
|---|---|---|
| **OFI** | Order Flow Imbalance — real-time bid/ask pressure with 2σ alerts | Bloomberg Terminal |
| **CVD** | Cumulative Volume Delta — Tick Rule & Lee-Ready classification | Institutional platforms |
| **VPIN** | Volume-Synchronized Probability of Informed Trading | Academic / prop shops |
| **VaR** | Real-Time Value at Risk — 99%/95%/90% confidence levels | Risk management desks |
| **Quant Signal Engine** | Multi-indicator composite score for directional bias | Proprietary |

### 🛠️ Terminal UX
- Command palette (`⌘K`) with fuzzy search across all actions and symbols
- Resizable panel layout with keyboard shortcuts (`Ctrl+1–4`)
- Dark / light theme toggle
- Economic calendar and news feed (CryptoPanic)
- On-chain data panel
- Mobile-gated (desktop-only, by design)

### 📢 Alert System
- Price-based alerts (above / below / crosses)
- Indicator triggers (RSI extremes, MACD crossovers, OFI spikes)
- Browser notifications with sound

### 📁 Paper Trading
- LONG/SHORT position tracking
- Automated P&L, win rate, profit factor, Sharpe ratio
- Risk and exposure analytics

---

## Getting Started

### Prerequisites
- Node.js ≥ 20 (see `.nvmrc`)
- A modern browser (Chrome 120+, Firefox 121+, Safari 17+)

### Local Development

```bash
git clone https://github.com/JWHaan/quant.term.git
cd quant.term
npm install
npm run dev          # → http://localhost:3000
```

No API keys required. The terminal uses public read-only WebSocket streams by default.

Optional: copy `.env.example` to `.env` to configure CryptoPanic, Deribit, or OpenBB endpoints.

### Production Build

```bash
npm run build        # type-check + bundle
npm run preview      # preview production build locally
```

### Deploy on Vercel

Click **Deploy with Vercel** above, or use the CLI:

```bash
npm i -g vercel
vercel --prod
```

The included `vercel.json` configures SPA routing, asset caching, and security headers automatically.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Type-check + production bundle |
| `npm run preview` | Preview production build locally |
| `npm run test` | Run unit tests (Vitest) |
| `npm run test:coverage` | Coverage report (target ≥ 70%) |
| `npm run type-check` | TypeScript type check only |
| `npm run lint` | ESLint |

---

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for a full breakdown. The short version:

```
src/
├── features/        # Feature-sliced modules (market, analytics, news, charts …)
├── services/        # WebSocket clients, data services, ML, risk engine
├── stores/          # Zustand stores with typed selectors
├── ui/              # Shared UI primitives (panels, modals, theme)
├── utils/           # Pure utility functions (formatting, math)
├── constants/       # App-wide constants and configuration
└── types/           # TypeScript type definitions
```

**Key decisions:**
- **Zustand over Redux** — eliminates unnecessary re-renders for high-frequency data; typed selectors prevent whole-store subscriptions
- **Direct WebSocket** — no proxy server; latency is browser ↔ exchange only
- **Web Workers** — heavy quant calculations run off the main thread
- **React.lazy** — secondary analytics panels are code-split for faster initial load

---

## Security

> **⚠️ Read-only terminal.** No trade execution. No real funds at risk.

- No API keys required for core functionality
- All data processing is client-side; nothing is sent to any backend
- Only `selectedSymbol` and `watchlist` are persisted to `localStorage`

See [SECURITY.md](./SECURITY.md) for the full security model and CSP configuration.

---

## Roadmap

| Phase | Status | Focus |
|---|---|---|
| 1 — Foundation | ✅ Complete | Memory safety, WebSocket hardening, CI/CD, error boundaries |
| 2 — Quant Core | 🔄 In progress | OFI, CVD, VPIN, VaR, Portfolio Greeks |
| 3 — Intelligence | ⏳ Planned | Volatility surface, ML signal layer, backtesting UI |
| 4 — Platform | ⏳ Planned | Plugin system, multi-exchange, community governance |

Full details in [ROADMAP.md](./ROADMAP.md) and [QUANT_ROADMAP.md](./QUANT_ROADMAP.md).

---

## Contributing

Pull requests are welcome. Before opening one, please read [CONTRIBUTING.md](./CONTRIBUTING.md).

```bash
# Branch naming
git checkout -b feat/volatility-smile
git checkout -b fix/ofi-memory-leak
git checkout -b docs/update-indicators

# Before committing
npm run lint && npm run type-check && npm run test
```

All PRs must pass CI. Indicator logic changes require test coverage.

---

## Troubleshooting

**OFFLINE status / no data**  
Check browser console for WebSocket errors. Ad blockers and some VPNs block `wss://` connections — try incognito mode.

**Chart frozen / memory warning**  
Open Chrome Task Manager. Memory usage should stay below 500MB for normal sessions. Refresh to clear buffers.

**429 rate limit errors**  
Binance limits: 5 msg/s, 300 connections/5min. Reconnection with exponential backoff is automatic. Reduce watchlist size if persistent.

---

## Acknowledgements

- [TradingView Lightweight Charts](https://github.com/tradingview/lightweight-charts) — charting engine
- [Binance](https://binance-docs.github.io/apidocs/) — public WebSocket API
- [Deribit](https://docs.deribit.com/) — options data
- [CryptoPanic](https://cryptopanic.com/developers/api/) — news feed
- Bloomberg Terminal — design reference

---

<div align="center">

MIT License · Built for the quant community · **Not financial advice**

</div>
