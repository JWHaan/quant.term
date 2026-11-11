# Changelog

Notable project changes are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). No release has been tagged yet.

## [Unreleased]

### Added

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

### Changed

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

### Removed

- Unreachable research prototypes, fabricated demo metrics, and their unused dependencies
- Duplicate market-store candle and trade buffers
- Obsolete cleanup scripts, starter assets, and one-time implementation reports
- Broken Docker deployment files
