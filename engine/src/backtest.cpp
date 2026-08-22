#include "quant/backtest.hpp"

#include <algorithm>
#include <cmath>
#include <limits>
#include <numeric>
#include <stdexcept>
#include <utility>

namespace quant {
namespace {

constexpr double bps_divisor = 10'000.0;
constexpr double seconds_per_year = 31'536'000.0;

struct OpenPosition {
    double entry_time{};
    std::size_t entry_bar_index{};
    double entry_price{};
    double quantity{};
    double entry_fee{};
};

[[nodiscard]] std::vector<std::optional<double>> calculate_sma_spreads(
    const std::vector<Candle>& candles,
    std::size_t fast_period,
    std::size_t slow_period
) {
    std::vector<std::optional<double>> spreads(candles.size());
    double fast_sum = 0.0;
    double slow_sum = 0.0;

    for (std::size_t index = 0; index < candles.size(); ++index) {
        const auto close = candles[index].close;
        fast_sum += close;
        slow_sum += close;

        if (index >= fast_period) {
            fast_sum -= candles[index - fast_period].close;
        }
        if (index >= slow_period) {
            slow_sum -= candles[index - slow_period].close;
        }
        if (index >= slow_period - 1U) {
            spreads[index] = (fast_sum / static_cast<double>(fast_period))
                - (slow_sum / static_cast<double>(slow_period));
        }
    }

    return spreads;
}

struct ClosedPosition {
    double cash{};
    Trade trade;
};

[[nodiscard]] ClosedPosition close_position(
    const OpenPosition& position,
    double exit_time,
    std::size_t exit_bar_index,
    double raw_exit_price,
    double cash,
    double fee_rate,
    double slippage_rate,
    ExitReason reason,
    std::size_t trade_number
) {
    const auto exit_price = raw_exit_price * (1.0 - slippage_rate);
    const auto proceeds = position.quantity * exit_price;
    const auto exit_fee = proceeds * fee_rate;
    const auto gross_pnl = (exit_price - position.entry_price) * position.quantity;
    const auto net_pnl = gross_pnl - position.entry_fee - exit_fee;

    Trade trade{
        .id = "trade-" + std::to_string(trade_number),
        .entry_time = position.entry_time,
        .exit_time = exit_time,
        .entry_price = position.entry_price,
        .exit_price = exit_price,
        .quantity = position.quantity,
        .entry_fee = position.entry_fee,
        .exit_fee = exit_fee,
        .gross_pnl = gross_pnl,
        .net_pnl = net_pnl,
        .return_pct = ((exit_price / position.entry_price) - 1.0) * 100.0,
        .bars_held = exit_bar_index - position.entry_bar_index,
        .exit_reason = reason,
    };

    return ClosedPosition{
        .cash = cash + proceeds - exit_fee,
        .trade = std::move(trade),
    };
}

[[nodiscard]] double calculate_sharpe(
    const std::vector<EquityPoint>& curve,
    double interval_seconds
) {
    if (curve.size() < 3U) {
        return 0.0;
    }

    std::vector<double> returns;
    returns.reserve(curve.size() - 1U);
    for (std::size_t index = 1; index < curve.size(); ++index) {
        const auto previous = curve[index - 1U].equity;
        if (previous > 0.0) {
            returns.push_back((curve[index].equity / previous) - 1.0);
        }
    }
    if (returns.size() < 2U) {
        return 0.0;
    }

    const auto mean = std::accumulate(returns.begin(), returns.end(), 0.0)
        / static_cast<double>(returns.size());
    double squared_difference_sum = 0.0;
    for (const auto value : returns) {
        squared_difference_sum += (value - mean) * (value - mean);
    }
    const auto variance = squared_difference_sum / static_cast<double>(returns.size() - 1U);
    const auto deviation = std::sqrt(variance);
    return deviation == 0.0 ? 0.0
        : (mean / deviation)
            * std::sqrt(seconds_per_year / interval_seconds);
}

[[nodiscard]] Metrics calculate_metrics(
    const BacktestConfig& config,
    const std::vector<Trade>& trades,
    const std::vector<EquityPoint>& curve,
    std::size_t exposed_bars
) {
    const auto final_equity = curve.empty() ? config.initial_capital : curve.back().equity;
    double winning_pnl = 0.0;
    double losing_pnl = 0.0;
    double total_fees = 0.0;
    std::size_t wins = 0U;

    for (const auto& trade : trades) {
        if (trade.net_pnl > 0.0) {
            winning_pnl += trade.net_pnl;
            ++wins;
        } else if (trade.net_pnl < 0.0) {
            losing_pnl += std::abs(trade.net_pnl);
        }
        total_fees += trade.entry_fee + trade.exit_fee;
    }

    double max_drawdown = 0.0;
    for (const auto& point : curve) {
        max_drawdown = std::max(max_drawdown, point.drawdown_pct);
    }

    return Metrics{
        .initial_capital = config.initial_capital,
        .final_equity = final_equity,
        .total_return_pct = ((final_equity / config.initial_capital) - 1.0) * 100.0,
        .max_drawdown_pct = max_drawdown,
        .total_trades = trades.size(),
        .win_rate_pct = trades.empty()
            ? 0.0
            : (static_cast<double>(wins) / static_cast<double>(trades.size())) * 100.0,
        .profit_factor = losing_pnl == 0.0
            ? std::nullopt
            : std::optional<double>{winning_pnl / losing_pnl},
        .sharpe_ratio = calculate_sharpe(curve, config.interval_seconds),
        .total_fees = total_fees,
        .exposure_pct = curve.empty()
            ? 0.0
            : (static_cast<double>(exposed_bars) / static_cast<double>(curve.size())) * 100.0,
    };
}

}  // namespace

void validate_input(const std::vector<Candle>& candles, const BacktestConfig& config) {
    if (!std::isfinite(config.initial_capital) || config.initial_capital <= 0.0) {
        throw std::invalid_argument{"Initial capital must be finite and positive"};
    }
    if (config.fast_period < 2U) {
        throw std::invalid_argument{"Fast period must be at least 2"};
    }
    if (config.slow_period <= config.fast_period) {
        throw std::invalid_argument{"Slow period must be greater than fast period"};
    }
    if (!std::isfinite(config.fee_bps) || config.fee_bps < 0.0 || config.fee_bps > 1'000.0) {
        throw std::invalid_argument{"Fee basis points are outside the supported range"};
    }
    if (
        !std::isfinite(config.slippage_bps)
        || config.slippage_bps < 0.0
        || config.slippage_bps > 1'000.0
    ) {
        throw std::invalid_argument{"Slippage basis points are outside the supported range"};
    }
    if (!std::isfinite(config.interval_seconds) || config.interval_seconds <= 0.0) {
        throw std::invalid_argument{"Interval seconds must be finite and positive"};
    }
    if (candles.size() < config.slow_period + 2U) {
        throw std::invalid_argument{"Insufficient candles"};
    }

    for (std::size_t index = 0; index < candles.size(); ++index) {
        const auto& candle = candles[index];
        const auto finite = std::isfinite(candle.time)
            && std::isfinite(candle.open)
            && std::isfinite(candle.high)
            && std::isfinite(candle.low)
            && std::isfinite(candle.close)
            && std::isfinite(candle.volume);
        if (!finite) {
            throw std::invalid_argument{"Candle contains a non-finite value"};
        }
        if (
            candle.open <= 0.0
            || candle.high <= 0.0
            || candle.low <= 0.0
            || candle.close <= 0.0
            || candle.volume < 0.0
        ) {
            throw std::invalid_argument{"Candle contains an invalid market value"};
        }
        if (
            candle.high < std::max(candle.open, candle.close)
            || candle.low > std::min(candle.open, candle.close)
            || candle.low > candle.high
        ) {
            throw std::invalid_argument{"Candle has inconsistent OHLC bounds"};
        }
        if (index > 0U && candle.time <= candles[index - 1U].time) {
            throw std::invalid_argument{"Candle timestamps must be strictly increasing"};
        }
    }
}

BacktestResult run_sma_cross(
    const std::vector<Candle>& candles,
    const BacktestConfig& config
) {
    validate_input(candles, config);

    const auto fee_rate = config.fee_bps / bps_divisor;
    const auto slippage_rate = config.slippage_bps / bps_divisor;
    const auto spreads = calculate_sma_spreads(candles, config.fast_period, config.slow_period);

    std::vector<Trade> trades;
    std::vector<EquityPoint> curve;
    curve.reserve(candles.size());

    double cash = config.initial_capital;
    std::optional<OpenPosition> position;
    double peak_equity = config.initial_capital;
    std::size_t exposed_bars = 0U;

    for (std::size_t index = 0; index < candles.size(); ++index) {
        const auto& candle = candles[index];

        if (index > 0U) {
            const auto signal = spreads[index - 1U];
            const auto prior_signal = index > 1U ? spreads[index - 2U] : std::nullopt;
            const auto prior = prior_signal.value_or(0.0);
            const auto crossed_up = signal.has_value() && signal.value() > 0.0 && prior <= 0.0;
            const auto crossed_down = signal.has_value() && signal.value() < 0.0 && prior >= 0.0;

            if (!position.has_value() && crossed_up) {
                const auto entry_price = candle.open * (1.0 + slippage_rate);
                const auto quantity = cash / (entry_price * (1.0 + fee_rate));
                const auto entry_notional = quantity * entry_price;
                const auto entry_fee = entry_notional * fee_rate;
                cash = std::max(0.0, cash - entry_notional - entry_fee);
                position = OpenPosition{
                    .entry_time = candle.time,
                    .entry_bar_index = index,
                    .entry_price = entry_price,
                    .quantity = quantity,
                    .entry_fee = entry_fee,
                };
            } else if (position.has_value() && crossed_down) {
                auto closed = close_position(
                    position.value(),
                    candle.time,
                    index,
                    candle.open,
                    cash,
                    fee_rate,
                    slippage_rate,
                    ExitReason::signal,
                    trades.size() + 1U
                );
                cash = closed.cash;
                trades.push_back(std::move(closed.trade));
                position.reset();
            }
        }

        if (position.has_value()) {
            ++exposed_bars;
        }

        auto equity = cash + (position.has_value() ? position->quantity * candle.close : 0.0);
        if (index == candles.size() - 1U && position.has_value()) {
            auto closed = close_position(
                position.value(),
                candle.time,
                index,
                candle.close,
                cash,
                fee_rate,
                slippage_rate,
                ExitReason::end_of_data,
                trades.size() + 1U
            );
            cash = closed.cash;
            trades.push_back(std::move(closed.trade));
            position.reset();
            equity = cash;
        }

        peak_equity = std::max(peak_equity, equity);
        curve.push_back(EquityPoint{
            .time = candle.time,
            .equity = equity,
            .drawdown_pct = peak_equity == 0.0
                ? 0.0
                : ((peak_equity - equity) / peak_equity) * 100.0,
            .position_quantity = position.has_value() ? position->quantity : 0.0,
        });
    }

    const auto metrics = calculate_metrics(config, trades, curve, exposed_bars);
    return BacktestResult{
        .metrics = metrics,
        .trades = std::move(trades),
        .equity_curve = std::move(curve),
    };
}

const char* to_string(ExitReason reason) noexcept {
    switch (reason) {
        case ExitReason::signal:
            return "SIGNAL";
        case ExitReason::end_of_data:
            return "END_OF_DATA";
    }
    return "UNKNOWN";
}

}  // namespace quant
