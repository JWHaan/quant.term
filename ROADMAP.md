# Roadmap

The roadmap is ordered by product risk and maintainability, not promised dates.

## Current foundation

- [x] Live Binance Spot market watch, candles, trades, and depth
- [x] Custom Canvas chart with technical overlays and depth heatmap
- [x] Binance USDⓈ-M derivatives and liquidations
- [x] Public news and Bitcoin network intelligence
- [x] Browser-local alerts and paper trading
- [x] Strategy Lab with deterministic BTC/USDT fixture replay
- [x] Versioned `backtest-v1` browser/native contract
- [x] C++20 SMA replay core with next-bar fills, costs, and golden correctness tests
- [x] Strict TypeScript across browser and edge code
- [x] Sites and Vercel deployment adapters
- [x] CI for lint, types, tests, coverage, and production build

## Next

- [ ] Share one selected-symbol depth subscription across chart, DOM, and OFI consumers
- [x] Split the chart renderer into data model, scales, drawing, and interaction modules (superseded: replaced the custom renderer with TradingView Lightweight Charts v5)
- [ ] Move panel-owned network requests into typed integration clients and feature hooks
- [ ] Add component and browser smoke tests for chart loading, symbol switching, and degraded providers
- [ ] Raise full-tree coverage floors as UI coverage lands
- [ ] Add accessible compact and tablet layouts without weakening the desktop terminal
- [ ] Add language-independent request/result fixtures for byte-stable browser/native parity
- [ ] Add a historical Binance adapter that preserves decimal strings, close times, and closed-candle state
- [ ] Publish the first tagged release after deployment and migration verification

## Later

- [ ] Optional multi-exchange market-data adapters with explicit normalization contracts
- [ ] Run benchmark-validated native backtest jobs through an isolated worker service
- [ ] Add importable Parquet/CSV datasets with explicit lineage and gap validation
- [ ] Add short positions, funding, maintenance margin, and liquidation after long-only validation
- [ ] Export/import for local preferences and paper portfolios
- [ ] Remote alerts or cross-device sync behind an opt-in authenticated service

## Explicit non-goals

- Custody, wallets, or real-money order execution
- Unverified “institutional-grade” latency or accuracy claims
- Fabricated fallback market, news, performance, or risk values
- Client-side storage of exchange credentials

New roadmap items should begin with a concrete data source, failure model, validation plan, and maintenance owner.
