#pragma once

#include <cstddef>
#include <optional>
#include <string>
#include <vector>

namespace quant {

inline constexpr auto contract_version = "backtest-v1";

struct Candle {
    double time{};
    double open{};
    double high{};
    double low{};
    double close{};
    double volume{};
};

struct BacktestConfig {
    double initial_capital{10'000.0};
    std::size_t fast_period{12};
    std::size_t slow_period{36};
    double fee_bps{10.0};
    double slippage_bps{5.0};
    // Bar spacing of the input dataset in seconds; drives Sharpe annualization
    // via bars_per_year = k_seconds_per_year / interval_seconds. Defaults to
    // 60 (1m) to keep the bundled fixture goldens unchanged.
    double interval_seconds{60.0};
};

enum class ExitReason {
    signal,
    end_of_data,
};

struct Trade {
    std::string id;
    double entry_time{};
    double exit_time{};
    double entry_price{};
    double exit_price{};
    double quantity{};
    double entry_fee{};
    double exit_fee{};
    double gross_pnl{};
    double net_pnl{};
    double return_pct{};
    std::size_t bars_held{};
    ExitReason exit_reason{ExitReason::signal};
};

struct EquityPoint {
    double time{};
    double equity{};
    double drawdown_pct{};
    double position_quantity{};
};

struct Metrics {
    double initial_capital{};
    double final_equity{};
    double total_return_pct{};
    double max_drawdown_pct{};
    std::size_t total_trades{};
    double win_rate_pct{};
    std::optional<double> profit_factor;
    double sharpe_ratio{};
    double total_fees{};
    double exposure_pct{};
};

struct BacktestResult {
    Metrics metrics;
    std::vector<Trade> trades;
    std::vector<EquityPoint> equity_curve;
};

void validate_input(const std::vector<Candle>& candles, const BacktestConfig& config);

[[nodiscard]] BacktestResult run_sma_cross(
    const std::vector<Candle>& candles,
    const BacktestConfig& config
);

[[nodiscard]] const char* to_string(ExitReason reason) noexcept;

}  // namespace quant
