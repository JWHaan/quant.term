# Roadmap

The roadmap is ordered by product risk and maintainability, not promised dates.
Domain vocabulary lives in `CONTEXT.md`; resolved design decisions live in `docs/adr/`.

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
- [x] `wasm` CI job: Rust fmt/clippy gate plus committed-bundle drift verification (`scripts/check-wasm.sh`, `wasm:build`, `wasm:build:ui`)

## v1.0.0 release gate

Everything required before the first tag. Nothing else blocks it.

- [ ] Fix MACD to textbook signal-line semantics across the Rust canonical engine, the TypeScript reference, and the canvas overlay; regenerate goldens ([ADR-0001](docs/adr/0001-macd-standard-signal-semantics.md))
- [ ] Harden `scripts/smoke.mjs` into real assertions — shell render, `top` symbol switching, bad-symbol error, theme persistence, tab navigation — plus a degraded-provider scenario (blocked feed must surface OFFLINE/unavailable states while the shell stays interactive)
- [ ] Run the smoke gate in CI against `npm run preview` as a required check
- [ ] Add `actions/dependency-review` to CI for diff-scoped dependency gating on PRs
- [ ] Tag `v1.0.0` and publish a GitHub Release after deployment verification

## Next (v1.x, hardening before expansion)

- [ ] Share one selected-symbol depth subscription across chart, DOM, and OFI consumers in `ui/src/services/binance_feed.rs` (replaces three parallel subscriptions)
- [ ] Finish moving panel-owned network requests behind typed service clients (`ui/src/services/rest.rs`, `binance_feed.rs`)
- [ ] Extend the wasm↔TS parity harness to shared request/result fixtures for byte-stable output
- [ ] Add a keyboard-driven chart crosshair with live-region readout and a text summary so the Canvas2D chart is inspectable by keyboard and assistive-tech users
- [ ] Add accessible compact and tablet layouts without weakening the desktop terminal (the mobile gate already guards small viewports)
- [ ] Adopt TypeScript 7 (native compiler) once `typescript-eslint` widens its `<6.1.0` peer range; the toolchain is currently capped at 5.9

## Later

- [ ] Optional multi-exchange market-data adapters with explicit normalization contracts
- [ ] Add importable Parquet/CSV datasets with explicit lineage and gap validation
- [ ] Add short positions, funding, maintenance margin, and liquidation to the Strategy Lab after long-only validation
- [ ] Export/import for local preferences and paper portfolios
- [ ] Remote alerts or cross-device sync behind an opt-in authenticated service — accounts never required for existing functionality ([ADR-0002](docs/adr/0002-no-accounts-boundary.md))

## Explicit non-goals

- Custody, wallets, or real-money order execution
- Unverified “institutional-grade” latency or accuracy claims
- Fabricated fallback market, news, performance, or risk values
- Client-side or server-side storage of exchange credentials

New roadmap items should begin with a concrete data source, failure model, validation plan, and maintenance owner.
