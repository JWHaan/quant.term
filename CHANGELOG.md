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
- GitHub issue, pull-request, and code-ownership metadata
- Separate Monitor and Strategy Lab workspaces
- Deterministic BTC/USDT SMA replay with next-bar fills, fees, slippage, and trade inspection
- Versioned `backtest-v1` result contract shared by the engine, UI, and parity harness
- Golden wasm↔TS result checks for the bundled synthetic fixture
- Domain glossary (`CONTEXT.md`) and architecture decision records under `docs/adr/` covering MACD semantics and the accounts boundary
- Header command line with mnemonics, a chart-docked microstructure ribbon, a collapsible TICK watchlist, and an amber terminal theme
- `wasm` CI job enforcing Rust fmt/clippy and committed-bundle drift verification, Cargo Dependabot coverage for both crates, and a pinned `rust-toolchain.toml`
- `AGENTS.md` and `.agents/rules/` contributor guidance for coding agents
- Retina README screenshots of the live terminal under `.github/assets`, regenerable via `scripts/screenshots.mjs`
- Playwright smoke gate in CI: `smoke.mjs` rewritten as an assertion gate with per-scenario reports, failure screenshots, and a deterministic degraded-provider scenario

### Changed

- `wasm` CI job now owns committed-bundle regeneration instead of only diff-gating: it rebuilds both bundles on linux-x86_64 and pushes the canonical bytes back to the PR branch (byte-diff gating proved impossible across host platforms — rustc wasm codegen differs between darwin-arm64, linux-arm64, and linux-x86_64 for identical sources)
- Rewrote the browser application in Rust/WASM: the `quant-ui` Leptos crate replaced the React/Zustand frontend, with signal-based stores, `binance_feed` WebSocket orchestration, and typed service clients
- Moved indicator and replay calculations into the shared `quant-core` engine; TypeScript remains as entry point, adapters, tests, and edge code
- Converted the remaining JavaScript order-book hook to strict TypeScript
- Expanded type checking to the Worker, Vercel adapter, build helpers, and config
- Made zero lint warnings a required quality gate
- Refreshed build and test dependencies to patched releases with a clean npm audit
- Refreshed dependencies again to clear the high-severity npm advisories (Vite, undici, zod, happy-dom, brace-expansion, Vitest)
- Corrected deployment output and documentation to match the generated artifacts
- Reordered the roadmap around an explicit v1.0.0 release gate: textbook MACD semantics, an asserting smoke gate in CI, and dependency review before the first tag
- Replaced historical project claims with an evidence-based capability and roadmap description
- Made the application header, footer, skip link, shortcuts, and command palette workspace-aware
- Moved the runtime to Node 24 LTS and aligned the type definitions, engines field, and package manager pin
- Restyled the terminal chrome on a tokenised type, radius, and motion scale: sharper neutral surfaces, hairline panel dividers, overlay scrollbars, amber focus rings, and theme-aware chart grid, frame, and crosshair colours
- DOM ladder header: the static title dropped its misleading ">" affordance, aggregation pills gained a `BUCKET` prefix and per-bucket tooltips, and the feed badge now reads `[WS OK]`/`[WS DOWN]`
- Clarified chrome labels: PERPS "Next" column reads "Funding In", movers groups read "▲ GAINERS"/"▼ LOSERS", the Research "Factors" tab is "Flow Factors", and internal contract IDs (`backtest-v1`) moved into tooltips
- Resize handles gained a permanent centered grip dot affordance so draggable seams read as interactive before hover
- Shortcuts modal lists the header command-line mnemonics (`TOP <SYM>`, `MON`, `LAB`, `MW`, `CHART`, `ALPHA`, `NEWS`, `KEYS`)

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
- Unified the command surfaces: the ⌘K palette now shares the header command line's grammar (`resolve_command_input` — exact mnemonics, `TOP <sym>` routing, mnemonic-aware substring filter) instead of a label-only filter
- Command palette covers every Market Watch instrument: `Analyze` commands are generated for all 40 `TOP_CRYPTOS` assets, and symbol-like queries (`bnb`, `/sol`, `top xrp`) resolve through `normalize_symbol_arg` to the same `set_symbol` dispatch
- Renamed focus commands to their rendered panel titles ("Focus Research Monitor", "Focus Market Intelligence")
- MODEL SCORE renders the signed heuristic score on its real ±70 scale with a component-breakdown tooltip instead of `abs()` + "%" — SELL −20 and BUY +20 no longer both read "20%"
- Data-quality badge no longer flashes OFFLINE on symbol swaps: a provenance engine that has never received a tick reports CONNECTING (amber) and OFFLINE is reserved for true drops after data flowed
- Header and footer feed chips no longer flash OFFLINE during symbol swaps: connecting/reconnecting telemetry renders as amber CONNECTING while OFFLINE is reserved for disconnected or errored feeds
- Bad `TOP` arguments no longer overwrite the typed command-line query; the error surfaces only in the status region and the input exposes `aria-invalid`

### Removed

- React/Zustand frontend tree and the `lightweight-charts` dependency
- C++20 engine under `engine/` and its native CI quality gate
- Unreachable research prototypes, fabricated demo metrics, and their unused dependencies
- Duplicate market-store candle and trade buffers
- Obsolete cleanup scripts, starter assets, and one-time implementation reports
- Broken Docker deployment files
- Historical `docs/superpowers/` plan and spec documents for the removed React implementation
