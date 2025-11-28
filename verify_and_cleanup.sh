#!/bin/bash

echo "🔍 Verifying and cleaning up unused files..."
echo ""

FILES_TO_CHECK=(
    "src/ui/ToastProvider.tsx"
    "src/ui/DetachableWindow.tsx"
    "src/ui/DisclaimerBanner.tsx"
    "src/features/charts/VolumeProfile.tsx"
    "src/features/charts/VaRChart.tsx"
    "src/features/market/CanvasTimeAndSales.tsx"
    "src/features/market/MarketHeatmap.tsx"
    "src/features/market/MarketSentiment.tsx"
    "src/features/market/FundingRatePanel.tsx"
    "src/features/market/FundamentalsPanel.tsx"
    "src/features/market/InstitutionalFeed.tsx"
    "src/features/trading/PortfolioManager.tsx"
    "src/features/trading/PairsTradingPanel.tsx"
    "src/features/trading/AlertPanel.tsx"
    "src/features/trading/CommandTerminal.tsx"
    "src/features/analytics/BacktestingDashboard.tsx"
    "src/features/analytics/MLSignalPanel.tsx"
    "src/features/analytics/StatisticalArbitrage.tsx"
    "src/features/analytics/OptionsGreeks.tsx"
    "src/features/analytics/RiskAnalytics.tsx"
    "src/features/analytics/CorrelationMatrix.tsx"
    "src/features/analytics/MomentumDashboard.tsx"
    "src/features/analytics/OptionsFlow.tsx"
    "src/features/analytics/OptionCalculator.tsx"
    "src/features/orderflow/DOMHeatmap.tsx"
    "src/features/news/OnChainFeed.tsx"
    "src/features/quality/DataQualityDashboard.tsx"
    "src/utils/performance.ts"
    "src/utils/wsConnectionManager.ts"
    "src/utils/varCalculator.ts"
    "src/utils/decimalHelpers.ts"
    "src/services/historicalDataService.ts"
    "src/services/plugin/TimeSeriesPlugins.ts"
    "src/services/backtest/BacktestEngine.ts"
    "src/services/apiClient.ts"
    "src/services/risk/riskWorker.ts"
    "src/components/OrderBookHeatmap.tsx"
    "src/hooks/useOrderBookHeatmapData.ts"
    "src/stores/backtestStore.ts"
    "src/types/indicatorMetadata.ts"
)

FOUND=0
REMOVED=0

for file in "${FILES_TO_CHECK[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ Found: $file"
        rm "$file"
        echo "   🗑️  Deleted"
        ((REMOVED++))
        ((FOUND++))
    fi
done

echo ""
echo "📊 Summary:"
echo "   Files checked: ${#FILES_TO_CHECK[@]}"
echo "   Files found: $FOUND"
echo "   Files removed: $REMOVED"
echo ""
