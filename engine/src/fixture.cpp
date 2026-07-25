#include "quant/fixture.hpp"

#include <algorithm>
#include <cmath>

namespace quant {
namespace {

constexpr double fixture_start_time = 1'704'067'200.0;
constexpr std::size_t fixture_candle_count = 480U;

[[nodiscard]] double round_decimal(double value, int digits) {
    const auto factor = std::pow(10.0, static_cast<double>(digits));
    return std::round(value * factor) / factor;
}

[[nodiscard]] double regime_level(std::size_t index) {
    if (index < 120U) {
        return 42'000.0 + (static_cast<double>(index) * 18.0);
    }
    if (index < 240U) {
        return 44'160.0 - (static_cast<double>(index - 120U) * 24.0);
    }
    if (index < 360U) {
        return 41'280.0 + (static_cast<double>(index - 240U) * 20.0);
    }
    return 43'680.0 - (static_cast<double>(index - 360U) * 10.0);
}

}  // namespace

std::vector<Candle> make_synthetic_btcusdt_fixture() {
    std::vector<Candle> candles;
    candles.reserve(fixture_candle_count);
    double previous_close = 42'000.0;

    for (std::size_t index = 0; index < fixture_candle_count; ++index) {
        const auto numeric_index = static_cast<double>(index);
        const auto close = round_decimal(
            regime_level(index)
                + (std::sin(numeric_index / 7.0) * 110.0)
                + (std::sin(numeric_index / 19.0) * 60.0),
            2
        );
        const auto open = previous_close;
        const auto high = round_decimal(
            std::max(open, close) + 20.0 + static_cast<double>(index % 11U),
            2
        );
        const auto low = round_decimal(
            std::min(open, close) - 18.0 - static_cast<double>(index % 7U),
            2
        );

        candles.push_back(Candle{
            .time = fixture_start_time + (numeric_index * 60.0),
            .open = open,
            .high = high,
            .low = low,
            .close = close,
            .volume = round_decimal(
                20.0 + static_cast<double>(index % 17U)
                    + (std::abs(std::sin(numeric_index / 8.0)) * 12.0),
                4
            ),
        });
        previous_close = close;
    }

    return candles;
}

}  // namespace quant
