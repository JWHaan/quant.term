#include "quant/backtest.hpp"
#include "quant/fixture.hpp"

#include <cstdint>
#include <iomanip>
#include <iostream>

int main() {
    const auto candles = quant::make_synthetic_btcusdt_fixture();
    const quant::BacktestConfig config{};
    const auto result = quant::run_sma_cross(candles, config);
    const auto& metrics = result.metrics;
    // Dataset provenance is derived from the candles so it cannot drift from the fixture.
    const auto checksum = quant::checksum_candles(candles);
    const auto start_time = static_cast<std::int64_t>(candles.front().time);
    const auto end_time = static_cast<std::int64_t>(candles.back().time);
    const auto interval_seconds = static_cast<std::int64_t>(config.interval_seconds);

    std::cout << std::fixed << std::setprecision(6)
              << "{\n"
              << "  \"contractVersion\": \"" << quant::contract_version << "\",\n"
              << "  \"engine\": \"CPP20_NATIVE\",\n"
              << "  \"strategy\": \"SMA_CROSS_LONG_FLAT\",\n"
              << "  \"dataset\": {\n"
              << "    \"id\": \"btc-synthetic-regimes-v1\",\n"
              << "    \"name\": \"BTC/USDT deterministic regime fixture\",\n"
              << "    \"symbol\": \"BTCUSDT\",\n"
              << "    \"interval\": \"1m\",\n"
              << "    \"source\": \"SYNTHETIC_FIXTURE\",\n"
              << "    \"checksum\": \"" << checksum << "\",\n"
              << "    \"candleCount\": " << candles.size() << ",\n"
              << "    \"startTime\": " << start_time << ",\n"
              << "    \"endTime\": " << end_time << ",\n"
              << "    \"intervalSeconds\": " << interval_seconds << ",\n"
              << "    \"fetchedAt\": 0\n"
              << "  },\n"
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
