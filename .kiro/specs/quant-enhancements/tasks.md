# Implementation Plan

- [ ] 1. Set up core infrastructure and new stores
  - Create quantStore.ts with correlation, statistical arbitrage, and ML prediction state management
  - Create backtestStore.ts with strategy configuration and results state
  - Implement Web Worker pool infrastructure for offloading computations
  - Set up IndexedDB wrapper using idb-keyval for historical data caching
  - _Requirements: 1.1, 1.3, 8.3_

- [ ] 2. Implement historical data service
  - [ ] 2.1 Create historicalDataService.ts with Binance API integration
    - Write fetchHistoricalData method with pagination support for large date ranges
    - Implement rate limiting to respect Binance 1200 req/min limit
    - Add data validation to check for gaps and invalid prices
    - _Requirements: 5.1, 8.2_

  - [ ] 2.2 Add IndexedDB caching layer
    - Implement cacheData method to store historical OHLCV data locally
    - Write getCachedData method to retrieve data from IndexedDB
    - Add clearOldCache method to remove data older than 30 days
    - _Requirements: 5.1, 8.1_

  - [ ] 2.3 Write unit tests for historical data service
    - Test API pagination logic
    - Test cache hit/miss scenarios
    - Test data validation edge cases
    - _Requirements: 5.1_

- [ ] 3. Implement statistical arbitrage engine
  - [ ] 3.1 Create statisticalArbEngine.ts with correlation calculations
    - Implement calculateCorrelation using Pearson coefficient with 30-day rolling window
    - Write calculateSpreadZScore for mean-reversion detection
    - Add calculateCorrelationMatrix for all asset pairs
    - _Requirements: 2.1, 2.2, 2.4_

  - [ ] 3.2 Add signal generation logic
    - Implement generateSignals method that triggers when z-score > 2.0
    - Calculate confidence scores based on correlation strength and z-score magnitude
    - Add signal filtering to only return high-quality opportunities (correlation > 0.7)
    - _Requirements: 2.3, 2.5_

  - [ ] 3.3 Write unit tests for statistical arbitrage
    - Test correlation calculation accuracy against known datasets
    - Test z-score calculation with synthetic spread data
    - Test signal generation thresholds
    - _Requirements: 2.1, 2.2, 2.3_

- [ ] 4. Create CorrelationMatrix component
  - [ ] 4.1 Build correlation heatmap UI
    - Create grid layout with color-coded cells (red = negative, green = positive)
    - Implement hover tooltips showing exact correlation values
    - Add click handler to select asset pairs for detailed analysis
    - Style with Bloomberg-inspired color scheme
    - _Requirements: 2.5_

  - [ ] 4.2 Integrate with quantStore and Web Worker
    - Connect to quantStore.correlationMatrix state
    - Trigger correlation calculations in Web Worker every 60 seconds
    - Display loading state during calculations
    - Handle errors with PanelErrorBoundary
    - _Requirements: 2.4, 8.3_

  - [ ] 4.3 Add interaction features
    - Implement pair selection that updates a spread chart
    - Add filter to show only pairs with correlation > threshold
    - Add sort functionality (by correlation strength)
    - _Requirements: 2.5_

- [ ] 5. Implement ML service and signal generation
  - [ ] 5.1 Create mlService.ts with TensorFlow.js integration
    - Set up TensorFlow.js with WebGL backend for GPU acceleration
    - Implement StandardScaler for feature normalization
    - Create model architecture (feedforward network with 2 hidden layers)
    - Add model save/load functionality using IndexedDB
    - _Requirements: 3.1, 3.5_

  - [ ] 5.2 Implement feature extraction pipeline
    - Write extractFeatures method that calculates RSI, MACD, BB position, volume ratio, OFI, funding rate
    - Normalize features using StandardScaler
    - Handle missing data with forward-fill strategy
    - _Requirements: 3.2_

  - [ ] 5.3 Add model training workflow
    - Implement trainModel method that uses last 7 days of 15-minute data
    - Create labels from forward 15-minute returns (up/down/neutral)
    - Add train/validation split (80/20)
    - Calculate model metrics (accuracy, precision, recall)
    - _Requirements: 3.4_

  - [ ] 5.4 Implement prediction and feature importance
    - Write predict method that returns direction and confidence
    - Only generate signals when confidence > 65%
    - Implement calculateFeatureImportance using permutation importance
    - _Requirements: 3.3, 3.5_

  - [ ] 5.5 Write unit tests for ML service
    - Test feature extraction with known market data
    - Test model training convergence
    - Test prediction output format and confidence bounds
    - Test feature importance calculation
    - _Requirements: 3.1, 3.2, 3.3_

- [ ] 6. Create MLSignalPanel component
  - [ ] 6.1 Build ML prediction display UI
    - Create card layout showing direction (UP/DOWN/NEUTRAL) with color coding
    - Display confidence percentage with progress bar
    - Show prediction horizon (15m/1h/4h)
    - Add last update timestamp
    - _Requirements: 3.5_

  - [ ] 6.2 Add feature importance visualization
    - Create horizontal bar chart showing feature importance rankings
    - Color-code bars by feature type (momentum, volatility, order flow)
    - Add tooltips explaining each feature
    - _Requirements: 3.5_

  - [ ] 6.3 Display model performance metrics
    - Show accuracy, precision, recall in metric cards
    - Display last training timestamp
    - Add "Retrain Model" button for manual trigger
    - Show training progress indicator
    - _Requirements: 3.4, 3.5_

  - [ ] 6.4 Integrate with quantStore and mlService
    - Connect to quantStore.mlPredictions state
    - Trigger predictions every 15 seconds for selected symbol
    - Handle model loading errors gracefully
    - Wrap in PanelErrorBoundary
    - _Requirements: 3.3, 3.5_

- [ ] 7. Implement risk analytics engine
  - [ ] 7.1 Create riskAnalyticsEngine.ts with VaR calculations
    - Implement calculateVaR using historical simulation method with 30-day window
    - Support 95% and 99% confidence levels
    - Add calculateCVaR for expected loss beyond VaR
    - _Requirements: 4.1, 4.2_

  - [ ] 7.2 Add Sharpe ratio and drawdown calculations
    - Implement calculateSharpeRatio with 30-day and 90-day windows
    - Write calculateMaxDrawdown that tracks peak-to-trough declines
    - Calculate current drawdown percentage
    - Add calculateBeta relative to BTC
    - _Requirements: 4.3, 4.4_

  - [ ] 7.3 Write unit tests for risk analytics
    - Test VaR calculation with known return distributions
    - Test CVaR calculation accuracy
    - Test Sharpe ratio with synthetic return series
    - Test drawdown calculation with equity curves
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 8. Enhance RiskAnalytics component
  - [ ] 8.1 Add VaR and CVaR displays
    - Create metric cards for VaR 95% and VaR 99%
    - Display CVaR with color-coded risk levels
    - Add historical VaR chart showing 30-day rolling values
    - _Requirements: 4.1, 4.2_

  - [ ] 8.2 Add Sharpe ratio and drawdown visualizations
    - Display rolling Sharpe ratio (30-day and 90-day) with line chart
    - Show maximum drawdown and current drawdown percentages
    - Create drawdown chart showing underwater equity curve
    - _Requirements: 4.3, 4.4_

  - [ ] 8.3 Integrate with portfolioStore and riskAnalyticsEngine
    - Connect to portfolioStore for position data
    - Calculate risk metrics every 5 seconds when positions are open
    - Use Web Worker for heavy calculations
    - Update displays in real-time
    - _Requirements: 4.5_

- [ ] 9. Implement backtest engine
  - [ ] 9.1 Create backtestEngine.ts with strategy execution
    - Implement run method that iterates through historical data
    - Write evaluateEntryRules that checks indicator conditions
    - Write evaluateExitRules for position closing logic
    - Add support for AND/OR logic in rule combinations
    - _Requirements: 5.2, 5.3_

  - [ ] 9.2 Add trade execution with fees and slippage
    - Implement executeTrade method that accounts for 0.04% Binance fees
    - Add configurable slippage (default 0.05%)
    - Track position size and leverage
    - Support both LONG and SHORT positions
    - _Requirements: 5.4_

  - [ ] 9.3 Implement performance metrics calculation
    - Write calculateMetrics method for total return, Sharpe ratio, win rate, profit factor
    - Calculate average win/loss and largest win/loss
    - Compute average holding period
    - Generate equity curve with drawdown tracking
    - _Requirements: 5.3_

  - [ ] 9.4 Write unit tests for backtest engine
    - Test strategy rule evaluation with mock data
    - Test trade execution and fee calculation
    - Test performance metrics accuracy
    - Test edge cases (no trades, all wins, all losses)
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 10. Create BacktestDashboard component
  - [ ] 10.1 Build strategy configuration UI
    - Create form for strategy name, symbol, timeframe, date range
    - Add rule builder with dropdown for indicator selection
    - Implement condition selector (ABOVE, BELOW, CROSSES_ABOVE, CROSSES_BELOW)
    - Add AND/OR logic toggle between rules
    - Include risk management inputs (stop loss, take profit, position size)
    - _Requirements: 5.2_

  - [ ] 10.2 Add backtest execution controls
    - Create "Run Backtest" button that triggers backtestStore.runBacktest
    - Display real-time progress bar during execution
    - Add "Stop" button to cancel running backtest
    - Show estimated time remaining
    - _Requirements: 5.1_

  - [ ] 10.3 Create results visualization
    - Build equity curve chart using Lightweight Charts
    - Add drawdown chart showing underwater periods
    - Create trade distribution histogram (wins vs losses)
    - Display performance metrics in card grid
    - _Requirements: 5.3_

  - [ ] 10.4 Integrate with backtestStore and backtestEngine
    - Connect to backtestStore for strategy config and results
    - Trigger backtest execution in Web Worker
    - Handle errors and display user-friendly messages
    - Wrap in PanelErrorBoundary
    - _Requirements: 5.1, 5.3_

- [ ] 11. Implement multi-timeframe analysis
  - [ ] 11.1 Add multi-timeframe data fetching
    - Extend historicalDataService to fetch multiple timeframes (5m, 15m, 1h, 4h)
    - Implement parallel fetching with Promise.all
    - Cache each timeframe separately in IndexedDB
    - _Requirements: 7.1_

  - [ ] 11.2 Calculate indicators across timeframes
    - Compute RSI, MACD, EMA for each timeframe
    - Store results in quantStore.multiTimeframeData
    - Update every 15 seconds
    - Use Web Worker for parallel calculations
    - _Requirements: 7.1, 7.4_

  - [ ] 11.3 Implement confluence detection
    - Write algorithm to detect when RSI crosses thresholds on multiple timeframes within 5 minutes
    - Calculate trend alignment score when EMAs point same direction on 3+ timeframes
    - Generate confluence signals with confidence scores
    - _Requirements: 7.2, 7.3_

- [ ] 12. Create MultiTimeframePanel component
  - [ ] 12.1 Build multi-timeframe grid layout
    - Create 2x2 grid showing 5m, 15m, 1h, 4h timeframes
    - Display RSI, MACD signal, and EMA trend for each timeframe
    - Color-code bullish (green) and bearish (red) indicators
    - _Requirements: 7.1, 7.5_

  - [ ] 12.2 Add confluence highlighting
    - Highlight cells when indicators align across timeframes
    - Display confluence score at top of panel
    - Show alert icon when RSI crosses thresholds on multiple timeframes
    - _Requirements: 7.2, 7.3_

  - [ ] 12.3 Integrate with quantStore
    - Connect to quantStore.multiTimeframeData
    - Update display every 15 seconds
    - Handle missing data gracefully
    - Wrap in PanelErrorBoundary
    - _Requirements: 7.4, 7.5_

- [ ] 13. Implement advanced order flow analytics
  - [ ] 13.1 Add cumulative volume delta (CVD) calculation
    - Extend calculateOFI in indicators.ts to track cumulative delta
    - Calculate CVD from time and sales data
    - Store CVD history for charting
    - _Requirements: 6.1_

  - [ ] 13.2 Implement large trade detection
    - Calculate 20-period rolling average trade size
    - Flag trades exceeding 3x average as "large trades"
    - Track large trade direction (buy vs sell)
    - _Requirements: 6.2_

  - [ ] 13.3 Add bid-ask spread analytics
    - Calculate real-time bid-ask spread from order book
    - Compute spread volatility over 1-minute windows
    - Detect spread widening events
    - _Requirements: 6.3_

  - [ ] 13.4 Implement order book imbalance detection
    - Calculate bid/ask volume ratio from order book depth
    - Flag imbalances when ratio exceeds 2.0
    - Track imbalance persistence over time
    - _Requirements: 6.4_

- [ ] 14. Enhance OrderFlowImbalance component
  - [ ] 14.1 Add CVD chart
    - Create line chart showing cumulative volume delta over time
    - Color-code positive (green) and negative (red) CVD
    - Add zero line for reference
    - _Requirements: 6.1_

  - [ ] 14.2 Display large trade feed
    - Create scrollable list of large trades with size, price, direction
    - Highlight institutional-sized trades (>10x average)
    - Add timestamp and symbol for each trade
    - _Requirements: 6.2_

  - [ ] 14.3 Show spread and imbalance metrics
    - Display current bid-ask spread with historical average
    - Show spread volatility indicator
    - Display order book imbalance ratio with visual gauge
    - _Requirements: 6.3, 6.4_

  - [ ] 14.4 Integrate with market data streams
    - Connect to Binance WebSocket for trade and order book data
    - Update CVD and metrics in real-time
    - Update display every trade tick
    - _Requirements: 6.5_

- [ ] 15. Enhance alert system with composite conditions
  - [ ] 15.1 Extend alertStore with composite alert support
    - Add support for multiple conditions with AND/OR logic
    - Implement condition types: INDICATOR, SIGNAL, CORRELATION, RISK
    - Store composite alert configurations in localStorage
    - _Requirements: 9.1_

  - [ ] 15.2 Add signal-based alert triggers
    - Implement alert when quant signal strength exceeds threshold
    - Add ML prediction confidence alerts
    - Support statistical arbitrage z-score alerts
    - _Requirements: 9.2_

  - [ ] 15.3 Add correlation and risk alerts
    - Implement correlation breakdown alerts (correlation drops below 0.5 within 1 hour)
    - Add VaR threshold alerts
    - Support drawdown percentage alerts
    - _Requirements: 9.3, 9.4_

  - [ ] 15.4 Enhance alert history tracking
    - Store triggered condition details with timestamps
    - Display alert history in AlertPanel
    - Add alert performance tracking (true positives vs false positives)
    - _Requirements: 9.5_

- [ ] 16. Implement data export functionality
  - [ ] 16.1 Add CSV export for market data
    - Install papaparse library for CSV generation
    - Implement exportOHLCV method with configurable date ranges
    - Add indicator values to export (RSI, MACD, BB)
    - Include download functionality with proper filename
    - _Requirements: 10.1, 10.3_

  - [ ] 16.2 Add trade history export
    - Implement exportTrades method for portfolio trade history
    - Include entry/exit prices, P&L, timestamps, fees
    - Add summary statistics at bottom of CSV
    - _Requirements: 10.2_

  - [ ] 16.3 Add correlation and signal export
    - Export correlation matrix as CSV
    - Export signal history with timestamps and confidence scores
    - Include ML predictions and feature importance
    - _Requirements: 10.4_

  - [ ] 16.4 Implement PDF report generation
    - Install jsPDF library for PDF creation
    - Create performance report template with equity curve chart
    - Include risk metrics table and trade statistics
    - Add export button to BacktestDashboard and PortfolioManager
    - _Requirements: 10.5_

- [ ] 17. Fix existing terminal issues
  - [ ] 17.1 Audit and fix console errors
    - Run terminal and identify all console errors
    - Fix React key warnings in list components
    - Resolve TypeScript type errors
    - Fix WebSocket connection warnings
    - _Requirements: 1.1_

  - [ ] 17.2 Improve WebSocket reconnection logic
    - Verify exponential backoff is working correctly in binanceFutures.ts
    - Ensure reconnection happens within 5 seconds
    - Add connection status indicators in DashboardHeader
    - Test reconnection under various network conditions
    - _Requirements: 1.2_

  - [ ] 17.3 Optimize rendering performance
    - Add React.memo to expensive components
    - Implement shouldComponentUpdate for chart components
    - Use useMemo for expensive calculations
    - Verify 50+ FPS at 100+ messages/second
    - _Requirements: 1.3_

  - [ ] 17.4 Verify error boundary isolation
    - Test that component errors don't crash other panels
    - Ensure PanelErrorBoundary displays fallback UI
    - Add retry functionality to error boundaries
    - _Requirements: 1.4_

  - [ ] 17.5 Optimize symbol switching
    - Reduce component re-renders on symbol change
    - Preload data for watchlist symbols
    - Ensure updates complete within 100ms
    - _Requirements: 1.5_

- [ ] 18. Performance optimization and Web Worker integration
  - [ ] 18.1 Create Web Worker for indicator calculations
    - Implement quantWorker.ts with message handlers
    - Move RSI, MACD, BB, ATR calculations to worker
    - Add error handling and timeout logic
    - Test worker performance vs main thread
    - _Requirements: 8.3_

  - [ ] 18.2 Implement worker pool management
    - Create WorkerPool class with dynamic worker count based on CPU cores
    - Add task queue for worker load balancing
    - Implement worker timeout and retry logic
    - _Requirements: 8.3_

  - [ ] 18.3 Optimize memory usage
    - Implement data virtualization for large order books (>500 levels)
    - Add memory monitoring and cleanup for old market data
    - Verify memory usage stays below 800MB with 10+ symbols
    - _Requirements: 8.1, 8.4_

  - [ ] 18.4 Implement lazy loading for secondary components
    - Lazy load BacktestDashboard, CorrelationMatrix, MLSignalPanel
    - Add Suspense boundaries with loading spinners
    - Measure initial bundle size reduction (target: <500KB)
    - _Requirements: 8.5_

  - [ ] 18.5 Performance testing and benchmarking
    - Test latency with 200+ WebSocket messages/second
    - Verify indicator calculations complete in <100ms
    - Test backtest performance with 10k candles
    - Profile memory usage over 1-hour session
    - _Requirements: 8.2, 8.3_

- [ ] 19. Integration and end-to-end testing
  - [ ] 19.1 Test statistical arbitrage workflow
    - Verify correlation calculations update every 60 seconds
    - Test signal generation when z-score exceeds threshold
    - Verify CorrelationMatrix displays and updates correctly
    - Test pair selection and spread visualization
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ] 19.2 Test ML signal generation workflow
    - Train model with sample data and verify metrics
    - Test prediction generation and confidence scoring
    - Verify MLSignalPanel displays predictions correctly
    - Test feature importance visualization
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ] 19.3 Test backtesting workflow
    - Create sample strategy and run backtest
    - Verify trade execution and fee calculations
    - Test performance metrics accuracy
    - Verify equity curve and drawdown charts display correctly
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ] 19.4 Test risk analytics workflow
    - Open test positions and verify risk metrics calculate
    - Test VaR and CVaR calculations with known data
    - Verify Sharpe ratio and drawdown tracking
    - Test real-time updates every 5 seconds
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ] 19.5 Test alert system enhancements
    - Create composite alerts with multiple conditions
    - Verify signal-based alerts trigger correctly
    - Test correlation breakdown and risk alerts
    - Verify alert history tracking
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 20. Documentation and final polish
  - [ ] 20.1 Update README with new features
    - Document statistical arbitrage capabilities
    - Add ML signal generation documentation
    - Document backtesting engine usage
    - Update architecture section with new components
    - _Requirements: All_

  - [ ] 20.2 Create user guide for quantitative features
    - Write guide for using correlation matrix
    - Document ML signal interpretation
    - Create backtesting tutorial with example strategies
    - Document risk metrics and their interpretation
    - _Requirements: All_

  - [ ] 20.3 Add JSDoc comments to new code
    - Document all public methods in services and engines
    - Add type documentation for complex interfaces
    - Document Web Worker message protocols
    - _Requirements: All_

  - [ ] 20.4 Final testing and bug fixes
    - Run full regression test suite
    - Fix any remaining bugs or edge cases
    - Verify all requirements are met
    - Test on multiple browsers (Chrome, Firefox, Safari)
    - _Requirements: All_
