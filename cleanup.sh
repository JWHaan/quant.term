#!/bin/bash

echo "🧹 Starting project cleanup..."
echo ""

# Count files before
BEFORE=$(find src -name "*.tsx" -o -name "*.ts" | wc -l | tr -d ' ')
echo "Files before cleanup: $BEFORE"
echo ""

# Remove unused UI components
echo "Removing unused UI components..."
rm -f src/ui/ToastProvider.tsx
rm -f src/ui/DetachableWindow.tsx
rm -f src/ui/DisclaimerBanner.tsx

# Remove unused layout (entire directory)
echo "Removing unused layout directory..."
rm -rf src/layout

# Remove test page
echo "Removing test page..."
rm -f src/ChartTestPage.tsx

# Remove unused chart components
echo "Removing unused chart components..."
rm -f src/features/charts/VolumeProfile.tsx
rm -f src/features/charts/VaRChart.tsx

# Remove unused market components
echo "Removing unused market components..."
rm -f src/features/market/CanvasTimeAndSales.tsx
rm -f src/features/market/MarketHeatmap.tsx
rm -f src/features/market/MarketSentiment.tsx
rm -f src/features/market/FundingRatePanel.tsx
rm -f src/features/market/FundamentalsPanel.tsx
rm -f src/features/market/InstitutionalFeed.tsx

# Remove unused trading components
echo "Removing unused trading components..."
rm -f src/features/trading/PortfolioManager.tsx
rm -f src/features/trading/PairsTradingPanel.tsx
rm -f src/features/trading/AlertPanel.tsx
rm -f src/features/trading/CommandTerminal.tsx

# Remove unused analytics components
echo "Removing unused analytics components..."
rm -f src/features/analytics/BacktestingDashboard.tsx
rm -f src/features/analytics/MLSignalPanel.tsx
rm -f src/features/analytics/StatisticalArbitrage.tsx
rm -f src/features/analytics/OptionsGreeks.tsx
rm -f src/features/analytics/RiskAnalytics.tsx
rm -f src/features/analytics/CorrelationMatrix.tsx
rm -f src/features/analytics/MomentumDashboard.tsx
rm -f src/features/analytics/OptionsFlow.tsx
rm -f src/features/analytics/OptionCalculator.tsx

# Remove unused orderflow
echo "Removing unused orderflow components..."
rm -f src/features/orderflow/DOMHeatmap.tsx

# Remove unused news
echo "Removing unused news components..."
rm -f src/features/news/OnChainFeed.tsx

# Remove unused quality
echo "Removing unused quality components..."
rm -f src/features/quality/DataQualityDashboard.tsx

# Remove unused utilities
echo "Removing unused utilities..."
rm -f src/utils/performance.ts
rm -f src/utils/wsConnectionManager.ts
rm -f src/utils/varCalculator.ts
rm -f src/utils/decimalHelpers.ts

# Remove unused services
echo "Removing unused services..."
rm -f src/services/historicalDataService.ts
rm -f src/services/plugin/TimeSeriesPlugins.ts
rm -f src/services/backtest/BacktestEngine.ts
rm -f src/services/apiClient.ts
rm -f src/services/risk/riskWorker.ts

# Remove unused components
echo "Removing unused components..."
rm -f src/components/OrderBookHeatmap.tsx

# Remove unused hooks
echo "Removing unused hooks..."
rm -f src/hooks/useOrderBookHeatmapData.ts

# Remove unused stores
echo "Removing unused stores..."
rm -f src/stores/backtestStore.ts

# Remove unused types
echo "Removing unused types..."
rm -f src/types/indicatorMetadata.ts

# Count files after
AFTER=$(find src -name "*.tsx" -o -name "*.ts" | wc -l | tr -d ' ')
REMOVED=$((BEFORE - AFTER))

echo ""
echo "✅ Cleanup complete!"
echo "Files after cleanup: $AFTER"
echo "Files removed: $REMOVED"
echo ""
echo "Running type check..."
