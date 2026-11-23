# Changelog

Notable project changes are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). No release has been tagged yet.

## [Unreleased]

### Added

- Leptos 0.8 WASM frontend (`quant-ui`) rendering the complete terminal: Monitor workspace, Strategy Lab, command palette, and chrome
- Rust/WASM `quant-core` engine for indicators, order-flow calculations, and deterministic SMA replay, shared by the UI crate and TypeScript adapters
- Custom Canvas2D candlestick chart with volume, EMA overlays, and native RSI/MACD panes
- wasm↔TypeScript parity suite for indicators and replay against kept reference implementations
- Committed wasm-bindgen bundles under `src/wasm` so installs and deployments need no Rust toolchain
- Live Binance Spot market watch, chart history, trades, and depth feeds
- Binance USDⓈ-M derivatives and liquidation panels
- Same-origin CoinDesk and Cointelegraph news aggregation
- Bitcoin network and Fear & Greed panels
- Browser-local alerts and paper trading
- Vercel `/api/news` Function adapter alongside the Sites/Cloudflare Worker
- GitHub issue, pull-request, ownership, and dependency-maintenance metadata
- Separate Monitor and Strategy Lab workspaces
- Deterministic BTC/USDT SMA replay with next-bar fills, fees, slippage, and trade inspection
- Native C++20 replay core, CTest suite, and `backtest-v1` contract schema
- Golden browser/native result checks for the bundled synthetic fixture
- Header command line with mnemonics, a chart-docked microstructure ribbon, a collapsible TICK watchlist, and an amber terminal theme
- `wasm` CI job enforcing Rust fmt/clippy and committed-bundle drift verification, Cargo Dependabot coverage for both crates, and a pinned `rust-toolchain.toml`
- `AGENTS.md` and `.agents/rules/` contributor guidance for coding agents

### Changed

- Rewrote the browser application in Rust/WASM: the `quant-ui` Leptos crate replaced the React/Zustand frontend, with signal-based stores, `binance_feed` WebSocket orchestration, and typed service clients
- Moved indicator and replay calculations into the shared `quant-core` engine; TypeScript remains as entry point, adapters, tests, and edge code
- Organized application composition under `src/app` and provider code under `src/integrations`
- Converted the remaining JavaScript order-book hook to strict TypeScript
- Expanded type checking to the Worker, Vercel adapter, build helpers, and config
- Made zero lint warnings a required quality gate
- Refreshed build and test dependencies to patched releases with a clean npm audit
- Migrated the Monitor workspace to react-resizable-panels v4 (`Group`/`Separator`, percentage string sizes)
- Refreshed dependencies again to clear the high-severity npm advisories (Vite, undici, zod, happy-dom, brace-expansion, Vitest)
- Corrected deployment output and documentation to match the generated artifacts
- Replaced historical project claims with an evidence-based capability and roadmap description
- Made the application header, footer, skip link, shortcuts, and command palette workspace-aware
- Refreshed browser and tooling dependencies to current released versions, including React 19.3, Vite 8.3, lightweight-charts 5.3, ESLint 10, and Vitest 5
- Moved the runtime to Node 24 LTS and aligned the type definitions, engines field, and package manager pin
- Migrated the workspace layout to react-resizable-panels v4 (`Group`/`Panel`/`Separator`) with explicit per-handle orientation modifiers
- Enforced the native C++20 CTest suite in CI so the documented quality gate matches the pipeline
- Restyled the terminal chrome on a tokenised type, radius, and motion scale: sharper neutral surfaces, hairline panel dividers, overlay scrollbars, amber focus rings, and theme-aware chart grid, frame, and crosshair colours

### Fixed

- Restored SPA fallback routing after authentication and direct navigation
- Corrected Sites asset packaging
- Recovered live market prices and chart candles through Binance's public market-data hosts
- Corrected indicator-alert condition evaluation
- Made paper leverage reserve initial margin and reject positions beyond free simulated equity
- Restored deterministic `localStorage` and `sessionStorage` in the happy-dom test environment
- Rust/WASM indicator panics on empty input and zero periods; invalid input now returns validation errors
- Boolean ARIA attributes rendering empty, missing dialog semantics and focus traps, and dead keyboard-shortcut wiring
- WebSocket and timer callbacks panicking after owner teardown, leaked resize listeners, and unbounded historical-candle fetches
- Security headers not applied on the Workers deployment and the vulnerable `url` crate (updated to 2.5.9)

### Removed

- React/Zustand frontend tree and the `lightweight-charts` dependency
- C++20 engine under `engine/` and its native CI quality gate
- Unreachable research prototypes, fabricated demo metrics, and their unused dependencies
- Duplicate market-store candle and trade buffers
- Obsolete cleanup scripts, starter assets, and one-time implementation reports
- Broken Docker deployment files
