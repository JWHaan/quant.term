#include "quant/backtest.hpp"
#include "quant/fixture.hpp"

#include <cassert>
#include <cmath>
#include <iostream>
#include <stdexcept>
#include <vector>

namespace {

void expect_near(double actual, double expected, double tolerance = 0.000001) {
    assert(std::abs(actual - expected) <= tolerance);
}

[[nodiscard]] std::vector<quant::Candle> candles_from_prices(
    const std::vector<double>& closes,
    const std::vector<double>& opens
) {
    std::vector<quant::Candle> candles;
    candles.reserve(closes.size());
    for (std::size_t index = 0; index < closes.size(); ++index) {
        const auto open = opens[index];
        const auto close = closes[index];
        candles.push_back(quant::Candle{
            .time = 1'700'000'000.0 + (static_cast<double>(index) * 60.0),
            .open = open,
            .high = std::max(open, close) + 1.0,
            .low = std::min(open, close) - 1.0,
            .close = close,
            .volume = 10.0,
        });
    }
    return candles;
}

void test_fixture_is_reproducible() {
    const auto candles = quant::make_synthetic_btcusdt_fixture();
    const quant::BacktestConfig config{};
    const auto first = quant::run_sma_cross(candles, config);
    const auto second = quant::run_sma_cross(candles, config);

    assert(!first.trades.empty());
    assert(first.trades.size() == second.trades.size());
    assert(first.equity_curve.size() == candles.size());
    assert(first.metrics.final_equity == second.metrics.final_equity);
    assert(first.metrics.total_fees == second.metrics.total_fees);
    // Golden values are shared with the TypeScript browser reference test.
    expect_near(first.metrics.final_equity, 10'692.208640);
    expect_near(first.metrics.total_return_pct, 6.922086);
    expect_near(first.metrics.max_drawdown_pct, 0.917863);
    assert(first.metrics.total_trades == 2U);
    expect_near(first.metrics.total_fees, 41.248917);
}

void test_signal_executes_at_next_open() {
    const auto candles = candles_from_prices(
        {10.0, 9.0, 8.0, 9.0, 12.0, 14.0, 13.0, 10.0, 8.0},
        {10.0, 10.0, 9.0, 8.0, 9.0, 20.0, 14.0, 13.0, 10.0}
    );
    const quant::BacktestConfig config{
        .initial_capital = 1'000.0,
        .fast_period = 2U,
        .slow_period = 3U,
        .fee_bps = 0.0,
        .slippage_bps = 0.0,
    };
    const auto result = quant::run_sma_cross(candles, config);

    assert(!result.trades.empty());
    assert(result.trades.front().entry_time == candles[5].time);
    assert(result.trades.front().entry_price == 20.0);
}

void test_costs_reduce_equity() {
    const auto candles = quant::make_synthetic_btcusdt_fixture();
    const auto free = quant::run_sma_cross(
        candles,
        quant::BacktestConfig{.fee_bps = 0.0, .slippage_bps = 0.0}
    );
    const auto costly = quant::run_sma_cross(candles, quant::BacktestConfig{});

    assert(costly.metrics.final_equity < free.metrics.final_equity);
    assert(costly.metrics.total_fees > 0.0);
}

void test_invalid_timestamp_is_rejected() {
    auto candles = quant::make_synthetic_btcusdt_fixture();
    candles[20].time = candles[19].time;

    bool threw = false;
    try {
        static_cast<void>(quant::run_sma_cross(candles, quant::BacktestConfig{}));
    } catch (const std::invalid_argument&) {
        threw = true;
    }
    assert(threw);
}

}  // namespace

int main() {
    test_fixture_is_reproducible();
    test_signal_executes_at_next_open();
    test_costs_reduce_equity();
    test_invalid_timestamp_is_rejected();
    std::cout << "quant backtest correctness tests passed\n";
    return 0;
}
