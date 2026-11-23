# Roadmap

The roadmap is ordered by product risk and maintainability, not promised dates.

## Current foundation

- [x] Live Binance Spot market watch, candles, trades, and depth
- [x] Custom Canvas2D chart with technical overlays and depth heatmap (`ui/src/features/charts`)
- [x] Binance USDⓈ-M derivatives and liquidations
- [x] Public news and Bitcoin network intelligence
- [x] Browser-local alerts and paper trading
- [x] Strategy Lab with deterministic BTC/USDT fixture replay
- [x] Historical Binance kline adapter that preserves decimal strings, close times, and closed-candle state
- [x] Versioned `backtest-v1` contract plus a wasm↔TS parity suite against a kept TypeScript reference (schema and result parity; no mechanical byte-parity harness yet)
- [x] Rust/WASM `quant-core` replay and indicator engine shared by the UI and the parity harness
- [x] Full Leptos 0.8 frontend: Monitor workspace, Strategy Lab, command palette, terminal chrome
- [x] Sites and Vercel deployment adapters
- [x] CI for lint, types, tests, coverage, and production build

## Next

- [ ] Share one selected-symbol depth subscription across chart, DOM, and OFI consumers in `ui/src/services/binance_feed.rs`
- [ ] Wire `scripts/build-ui-wasm.sh` and `scripts/check-wasm.sh` into npm scripts and CI so the UI crate and clippy gate run automatically
- [ ] Finish moving panel-owned network requests behind typed service clients (`ui/src/services/rest.rs`, `binance_feed.rs`)
- [ ] Add browser smoke tests for chart loading, symbol switching, and degraded providers (Playwright driver exists as `npm run shot`)
- [ ] Extend the wasm↔TS parity harness to shared request/result fixtures for byte-stable output
- [ ] Add accessible compact and tablet layouts without weakening the desktop terminal (the mobile gate already guards small viewports)
- [ ] Adopt TypeScript 7 (native compiler) once `typescript-eslint` widens its `<6.1.0` peer range; the toolchain is currently capped at 5.9
- [ ] Publish the first tagged release after deployment and migration verification

## Later

- [ ] Optional multi-exchange market-data adapters with explicit normalization contracts
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
