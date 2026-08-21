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

### Changed

- Organized application composition under `src/app` and provider code under `src/integrations`
- Converted the remaining JavaScript order-book hook to strict TypeScript
- Expanded type checking to the Worker, Vercel adapter, build helpers, and config
- Made zero lint warnings a required quality gate
- Refreshed build and test dependencies to patched releases with a clean npm audit
- Corrected deployment output and documentation to match the generated artifacts
- Replaced historical project claims with an evidence-based capability and roadmap description
- Made the application header, footer, skip link, shortcuts, and command palette workspace-aware

### Fixed

- Restored SPA fallback routing after authentication and direct navigation
- Corrected Sites asset packaging
- Recovered live market prices and chart candles through Binance's public market-data hosts
- Corrected indicator-alert condition evaluation
- Made paper leverage reserve initial margin and reject positions beyond free simulated equity

### Removed

- Unreachable research prototypes, fabricated demo metrics, and their unused dependencies
- Duplicate market-store candle and trade buffers
- Obsolete cleanup scripts, starter assets, and one-time implementation reports
- Broken Docker deployment files
