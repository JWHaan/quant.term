# Changelog

All notable changes to quant.term will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Production readiness roadmap with 7 priority levels
- Comprehensive implementation plan for v1.0 launch

### Changed
- Component architecture restructured into feature-based modules
- Improved TabPanel to keep all tabs mounted (prevents remounting)

### Fixed
- Market Watch symbol selection now updates all panels
- Order Book no longer alternates between symbols during switching
- ESLint `react-hooks/set-state-in-effect` error resolved

## [0.2.0] - 2024-11-24

### Added
- Feature-based component architecture (`src/features/`, `src/ui/`, `src/layout/`)
- Path aliases in `tsconfig.json` (`@/ui`, `@/features`, `@/layout`)
- TypeScript migration for `useFundamentals` hook
- `useConnectionLatency` hook for performance monitoring
- Test infrastructure with Vitest
- Initial test coverage for indicators (RSI, MACD, Bollinger Bands, EMA, SMA, ATR)

### Changed
- Migrated all components from flat `src/components/` to domain-driven structure
- Updated all imports to use absolute paths with `@/` aliases
- Improved WebSocket cleanup in `useOrderBook` hook

### Fixed
- TabPanel causing component remounting and flashing
- WebSocket race condition in Order Book
- Symbol switching not propagating to all components

## [0.1.0] - 2024-11-23

### Added
- Real-time WebSocket data integration (Binance, Deribit)
- Technical indicators:
  - RSI (Relative Strength Index)
  - MACD (Moving Average Convergence Divergence)
  - Bollinger Bands
  - EMA/SMA (Exponential/Simple Moving Averages)
  - ATR (Average True Range)
  - VWAP (Volume-Weighted Average Price)
- TradingView lightweight-charts integration
- Order Book DOM (Depth of Market) visualization
- Liquidation feed with real-time updates
- Alert system with browser notifications
- Paper trading portfolio manager with P&L tracking
- Market heatmap with treemap visualization
- News feed aggregation
- Economic calendar
- On-chain analytics panel
- Quant signal engine with multi-indicator analysis
- Alpha factor panel
- Options Greeks calculator
- Options flow analysis
- Statistical arbitrage signals
- Risk analytics dashboard
- Backtesting framework
- Command terminal for quick actions
- Keyboard shortcuts modal
- Performance monitoring panel (FPS, latency)
- Theme provider with Bloomberg-inspired dark theme
- Error boundaries for fault isolation
- Loading states and spinners

### Technical
- React 19 with TypeScript
- Zustand for state management
- Vite for build tooling
- ESLint + Prettier for code quality
- Vitest for testing
- react-resizable-panels for layout
- react-virtuoso for virtual scrolling
- Three.js for 3D visualizations

### Documentation
- Comprehensive README with features and setup
- Architecture documentation
- Security guidelines

## [0.0.1] - 2024-11-22

### Added
- Initial project setup
- Basic React + TypeScript configuration
- Vite build configuration
- ESLint and TypeScript configuration

---

## Release Notes Format

### Added
New features and capabilities

### Changed
Changes to existing functionality

### Deprecated
Features that will be removed in future releases

### Removed
Features that have been removed

### Fixed
Bug fixes

### Security
Security vulnerability fixes

---

**Legend:**
- 🎉 Major feature
- ✨ Enhancement
- 🐛 Bug fix
- 📚 Documentation
- 🔒 Security
- ⚡ Performance
- 🎨 UI/UX
