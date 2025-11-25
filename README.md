# quant.term - Professional Cryptocurrency Trading Terminal

> A Bloomberg Terminal-inspired crypto trading interface with real-time data, advanced technical analysis, and institutional-grade features.

![Version](https://img.shields.io/badge/version-3.0.0-orange)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)
![React](https://img.shields.io/badge/React-19.2-61DAFB)
![License](https://img.shields.io/badge/license-MIT-green)
![CI](https://github.com/JWHaan/quant.term/actions/workflows/ci.yml/badge.svg)


## 🚀 Features

### Real-Time Market Data
- **100% Live Data** via WebSocket connections to Binance Futures and Deribit
- Sub-50ms tick-to-chart latency for institutional-grade performance
- Multi-asset monitoring with customizable watchlists
- Real-time order book depth (DOM) visualization

### Advanced Charting
- **TradingView Lightweight Charts** integration for professional-grade visualization
- Complete technical indicator suite:
  - RSI (Relative Strength Index) with Wilder's smoothing
  - MACD (Moving Average Convergence Divergence)
  - Bollinger Bands (20-period, 2σ)
  - EMA/SMA overlays
  - Volume Profile and VWAP
- Multiple timeframes: 1m to 1M

### Quantitative Analysis
- **Quant Signal Engine**: Multi-indicator scoring system for directional bias
- **Order Flow Imbalance (OFI)**: Real-time buy/sell pressure analysis
- **Liquidation Feed**: Track large liquidations across major exchanges
- **Options Flow Analytics**: Greeks, implied volatility, and block trade detection (Deribit)

### Alert System
- Price-based alerts (above/below/crosses)
- Indicator-based triggers (RSI extremes, MACD crossovers)
- Volume and OFI alerts
- Browser notifications with sound alerts
- Alert history and management

### Portfolio Management (Paper Trading)
- Position tracking (LONG/SHORT)
- Automatic P&L calculation
- Performance statistics (win rate, profit factor, Sharpe ratio)
- Risk analytics and exposure monitoring

## 🗺️ Roadmap

We follow a [Strategic Roadmap](./ROADMAP.md) focused on stability, zero-cost infrastructure, and community governance.

### Phase 1: Critical Fixes (Current)
- [ ] Eliminate Memory Leaks (Circular buffers, WeakRef)
- [ ] Harden WebSocket Layer (Connection pooling, Offline mode)
- [ ] Error Boundaries & Graceful Degradation

### Phase 2: Optional Backend
- [ ] Cloudflare Workers + D1 Backend
- [ ] Mobile-First Redesign

See [ROADMAP.md](./ROADMAP.md) for the full vision.

## 📋 System Requirements

### Minimum Requirements
- **Browser**: Chrome 120+, Firefox 121+, Safari 17+, or Edge 120+
- **RAM**: 8GB
- **CPU**: 4-core processor
- **Network**: Stable internet connection (10 Mbps+)

### Recommended for Optimal Performance
- **Browser**: Chrome 120+ (best WebSocket performance)
- **RAM**: 16GB
- **CPU**: 8-core processor
- **Network**: High-speed internet (50 Mbps+)

## 🛠️ Installation & Setup

```bash
# Clone the repository
git clone https://github.com/JWHaan/quant.term.git
cd quant.term

# Install dependencies
npm install

# Set up environment variables (optional)
cp .env.example .env
# Edit .env if needed (no API keys required for read-only mode)

# Start development server
npm run dev
```

The application will open at `http://localhost:3000`

## 📜 Available Scripts

```bash
# Development
npm run dev              # Start Vite dev server with HMR
npm run type-check       # Check TypeScript types without compiling
npm run lint             # Run ESLint

# Testing
npm run test             # Run unit tests with Vitest
npm run test:coverage    # Generate coverage report (target: 70%+)

# Production
npm run build            # Type-check + build for production
npm run preview          # Preview production build locally
```

## 🏗️ Architecture

quant.term is built with modern web technologies optimized for real-time financial data:

- **React 19** with TypeScript for type-safe component development
- **Zustand** for performant state management (35ms vs 75ms for Context API)
- **TradingView Lightweight Charts** (43KB bundle, optimized for 60fps)
- **WebSocket** direct connections to Binance Futures and Deribit
- **Vite** for blazing-fast development and optimized production builds

### Key Design Decisions

1. **TypeScript Migration**: All code strictly typed to prevent calculation errors in trading logic
2. **Zustand over Redux**: Eliminates unnecessary re-renders for high-frequency market data
3. **Direct WebSocket**: No intermediary servers to minimize latency
4. **Component Lazy Loading**: React.lazy() for secondary analytics to improve initial load time

For detailed architecture documentation, see [ARCHITECTURE.md](./ARCHITECTURE.md)

## 🔐 Security

> **⚠️ IMPORTANT**: This is a **read-only trading terminal** for educational and analysis purposes. No trading execution capabilities are included.

- **No API Keys Required**: Public WebSocket streams only
- **Client-Side Only**: All data processing happens in your browser
- **No Data Storage**: Market data is not persisted (only user preferences in localStorage)
- **Paper Trading Only**: Portfolio tracking is simulated; no real funds at risk

For security best practices and attack surface analysis, see [SECURITY.md](./SECURITY.md)

## 📊 Technical Indicators

All indicators are implemented with strict accuracy requirements and validated against TradingView:

### RSI (Relative Strength Index)
- **Algorithm**: Wilder's smoothing method
- **Period**: 14 (configurable)
- **Accuracy**: ±0.1% vs TradingView
- **Use Case**: Overbought (>70) / Oversold (<30) detection

### MACD (Moving Average Convergence Divergence)
- **Parameters**: 12, 26, 9 (fast, slow, signal)
- **Signal**: Histogram crossovers
- **Use Case**: Trend direction and momentum

### Bollinger Bands
- **Parameters**: 20-period SMA, 2 standard deviations
- **Use Case**: Volatility and mean reversion

For complete indicator documentation, see [docs/INDICATORS.md](./docs/INDICATORS.md)

## 🧪 Testing

quant.term maintains **70%+ test coverage** for core trading logic:

```bash
# Run all tests
npm run test

# Watch mode during development
npm run test -- --watch

# Coverage report
npm run test:coverage
```

### Test Coverage Areas
- ✅ Indicator calculations (100% coverage requirement)
- ✅ Zustand store state management
- ✅ WebSocket connection handling
- ✅ Alert triggering logic
- ✅ P&L calculations

## 🐛 Troubleshooting

### WebSocket Connection Issues
**Problem**: "OFFLINE" status in header, no live data  
**Solution**:
1. Check browser console for WebSocket errors
2. Verify internet connectivity
3. Disable browser extensions (ad blockers can interfere)
4. Try incognito/private mode

### Chart Not Updating
**Problem**: Chart frozen or lagging  
**Solution**:
1. Refresh the page (Ctrl/Cmd + R)
2. Check Chrome Task Manager for memory usage (should be <500MB)
3. Close other tabs to free up resources

### Rate Limit Errors
**Problem**: Console shows "429 Too Many Requests"  
**Solution**:
- Binance limits: 5 messages/sec, 300 connections/5min
- Reduce number of symbols in watchlist
- Reconnection happens automatically with exponential backoff

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. **Code Style**: Run `npm run lint` before committing
2. **TypeScript**: No `any` types; use strict mode
3. **Testing**: Maintain 70%+ coverage; all indicator tests must pass
4. **Documentation**: Add JSDoc comments for public functions

### Development Workflow
```bash
# 1. Create feature branch
git checkout -b feature/your-feature

# 2. Make changes and test
npm run test
npm run type-check

# 3. Commit with descriptive message
git commit -m "feat: add volatility smile visualization"

# 4. Push and open pull request
git push origin feature/your-feature
```

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details

## 🙏 Acknowledgments

- **TradingView** for Lightweight Charts library
- **Binance** for public WebSocket API
- **Deribit** for options data API
- **Bloomberg Terminal** for design inspiration

## 📞 Contact & Support

- **Issues**: [GitHub Issues](https://github.com/JWHaan/quant.term/issues)
- **Discussions**: [GitHub Discussions](https://github.com/JWHaan/quant.term/discussions)
- **Email**: support@quantterm.dev

---

Built with ❤️ for the crypto trading community | **Not financial advice**
