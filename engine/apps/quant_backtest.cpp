#include "quant/backtest.hpp"
#include "quant/fixture.hpp"

#include <iomanip>
#include <iostream>

int main() {
    const auto candles = quant::make_synthetic_btcusdt_fixture();
    const quant::BacktestConfig config{};
    const auto result = quant::run_sma_cross(candles, config);
    const auto& metrics = result.metrics;

    std::cout << std::fixed << std::setprecision(6)
              << "{\n"
              << "  \"contractVersion\": \"" << quant::contract_version << "\",\n"
              << "  \"engine\": \"CPP20_NATIVE\",\n"
              << "  \"strategy\": \"SMA_CROSS_LONG_FLAT\",\n"
              << "  \"dataset\": \"btc-synthetic-regimes-v1\",\n"
              << "  \"metrics\": {\n"
              << "    \"finalEquity\": " << metrics.final_equity << ",\n"
              << "    \"totalReturnPct\": " << metrics.total_return_pct << ",\n"
              << "    \"maxDrawdownPct\": " << metrics.max_drawdown_pct << ",\n"
              << "    \"totalTrades\": " << metrics.total_trades << ",\n"
              << "    \"winRatePct\": " << metrics.win_rate_pct << ",\n"
              << "    \"sharpeRatio\": " << metrics.sharpe_ratio << ",\n"
              << "    \"totalFees\": " << metrics.total_fees << ",\n"
              << "    \"exposurePct\": " << metrics.exposure_pct << "\n"
              << "  }\n"
              << "}\n";

    return 0;
}
