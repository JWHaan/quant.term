#pragma once

#include "quant/backtest.hpp"

#include <vector>

namespace quant {

[[nodiscard]] std::vector<Candle> make_synthetic_btcusdt_fixture();

}  // namespace quant
