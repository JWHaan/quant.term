# Roadmap

The roadmap is ordered by product risk and maintainability, not promised dates.

## Current foundation

- [x] Live Binance Spot market watch, candles, trades, and depth
- [x] Custom Canvas chart with technical overlays and depth heatmap
- [x] Binance USDⓈ-M derivatives and liquidations
- [x] Public news and Bitcoin network intelligence
- [x] Browser-local alerts and paper trading
- [x] Strict TypeScript across browser and edge code
- [x] Sites and Vercel deployment adapters
- [x] CI for lint, types, tests, coverage, and production build

## Next

- [ ] Share one selected-symbol depth subscription across chart, DOM, and OFI consumers
- [ ] Split the chart renderer into data model, scales, drawing, and interaction modules
- [ ] Move panel-owned network requests into typed integration clients and feature hooks
- [ ] Add component and browser smoke tests for chart loading, symbol switching, and degraded providers
- [ ] Raise full-tree coverage floors as UI coverage lands
- [ ] Add accessible compact and tablet layouts without weakening the desktop terminal
- [ ] Publish the first tagged release after deployment and migration verification

## Later

- [ ] Optional multi-exchange market-data adapters with explicit normalization contracts
- [ ] Historical replay and deterministic strategy research
- [ ] Export/import for local preferences and paper portfolios
- [ ] Remote alerts or cross-device sync behind an opt-in authenticated service

## Explicit non-goals

- Custody, wallets, or real-money order execution
- Unverified “institutional-grade” latency or accuracy claims
- Fabricated fallback market, news, performance, or risk values
- Client-side storage of exchange credentials

New roadmap items should begin with a concrete data source, failure model, validation plan, and maintenance owner.
