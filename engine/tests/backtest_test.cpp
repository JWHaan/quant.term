#include "quant/backtest.hpp"
#include "quant/fixture.hpp"

#include <algorithm>
#include <cmath>
#include <exception>
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>

namespace {

// The checks throw instead of using assert(): Release builds define NDEBUG, which
// would turn assert() into a no-op and silently skip every comparison.
void expect_true(bool condition, const char* expression) {
    if (!condition) {
        throw std::runtime_error{std::string{"EXPECT failed: "} + expression};
    }
}

#define EXPECT(condition) expect_true((condition), #condition)

void expect_near(double actual, double expected, double tolerance = 0.000001) {
    if (!(std::abs(actual - expected) <= tolerance)) {
        throw std::runtime_error{
            "expect_near failed: actual=" + std::to_string(actual)
            + " expected=" + std::to_string(expected)};
    }
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

    EXPECT(!first.trades.empty());
    EXPECT(first.trades.size() == second.trades.size());
    EXPECT(first.equity_curve.size() == candles.size());
    EXPECT(first.metrics.final_equity == second.metrics.final_equity);
    EXPECT(first.metrics.total_fees == second.metrics.total_fees);
    // Golden values are shared with the TypeScript browser reference test.
    expect_near(first.metrics.final_equity, 10'692.208640);
    expect_near(first.metrics.total_return_pct, 6.922086);
    expect_near(first.metrics.max_drawdown_pct, 0.917863);
    EXPECT(first.metrics.total_trades == 2U);
    expect_near(first.metrics.total_fees, 41.248917);
}

void test_fixture_metadata_is_derived_from_candles() {
    const auto candles = quant::make_synthetic_btcusdt_fixture();

    // Golden values shared with the browser fixture test (src/tests/backtest/engine.test.ts).
    EXPECT(candles.size() == 480U);
    EXPECT(quant::checksum_candles(candles) == "fnv1a-3b3cacbb");

    auto mutated = candles;
    mutated.back().close += 0.01;
    EXPECT(quant::checksum_candles(mutated) != quant::checksum_candles(candles));
    // No candles leaves the hash at the FNV-1a offset basis.
    EXPECT(quant::checksum_candles(std::vector<quant::Candle>{}) == "fnv1a-811c9dc5");
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

    EXPECT(!result.trades.empty());
    EXPECT(result.trades.front().entry_time == candles[5].time);
    EXPECT(result.trades.front().entry_price == 20.0);
}

void test_costs_reduce_equity() {
    const auto candles = quant::make_synthetic_btcusdt_fixture();
    const auto free = quant::run_sma_cross(
        candles,
        quant::BacktestConfig{.fee_bps = 0.0, .slippage_bps = 0.0}
    );
    const auto costly = quant::run_sma_cross(candles, quant::BacktestConfig{});

    EXPECT(costly.metrics.final_equity < free.metrics.final_equity);
    EXPECT(costly.metrics.total_fees > 0.0);
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
    EXPECT(threw);
}

void test_interval_seconds_scales_sharpe_annualization() {
    const auto candles = quant::make_synthetic_btcusdt_fixture();

    // Default config: interval_seconds implicitly 60 -> 1m goldens must hold.
    const auto one_minute = quant::run_sma_cross(candles, quant::BacktestConfig{});
    expect_near(one_minute.metrics.final_equity, 10'692.208640);
    expect_near(one_minute.metrics.total_return_pct, 6.922086);

    const auto hourly = quant::run_sma_cross(
        candles,
        quant::BacktestConfig{.interval_seconds = 3'600.0}
    );

    // The equity curve itself is interval-independent: identical prices
    // produce identical per-bar returns. Only the Sharpe annualization factor
    // sqrt(seconds_per_year / interval_seconds) changes, so the two runs are
    // pinned by sharpe_1h = sharpe_1m * sqrt(60 / 3600) = sharpe_1m * sqrt(1/60).
    expect_near(
        hourly.metrics.sharpe_ratio,
        one_minute.metrics.sharpe_ratio * std::sqrt(1.0 / 60.0),
        1e-9
    );
    // Equity/return metrics do not depend on the interval.
    expect_near(hourly.metrics.final_equity, one_minute.metrics.final_equity);
    expect_near(hourly.metrics.total_return_pct, one_minute.metrics.total_return_pct);
}

void test_nonpositive_interval_seconds_is_rejected() {
    const auto candles = quant::make_synthetic_btcusdt_fixture();

    for (const auto bad_interval : {0.0, -60.0, std::nan("")}) {
        bool threw = false;
        try {
            static_cast<void>(quant::run_sma_cross(
                candles,
                quant::BacktestConfig{.interval_seconds = bad_interval}
            ));
        } catch (const std::invalid_argument&) {
            threw = true;
        }
        if (!threw) {
            throw std::runtime_error{"non-positive interval_seconds was accepted"};
        }
    }
}

}  // namespace

int main() {
    try {
        test_fixture_is_reproducible();
        test_fixture_metadata_is_derived_from_candles();
        test_signal_executes_at_next_open();
        test_costs_reduce_equity();
        test_invalid_timestamp_is_rejected();
        test_interval_seconds_scales_sharpe_annualization();
        test_nonpositive_interval_seconds_is_rejected();
    } catch (const std::exception& error) {
        std::cerr << "quant backtest correctness tests failed: " << error.what() << '\n';
        return 1;
    }
    std::cout << "quant backtest correctness tests passed\n";
    return 0;
}
