#pragma once

#include "quant/backtest.hpp"

#include <span>
#include <string>
#include <vector>

namespace quant {

[[nodiscard]] std::vector<Candle> make_synthetic_btcusdt_fixture();

// FNV-1a content checksum, byte-identical to checksumCandles() in
// src/backtest/fixture.ts for values JavaScript prints without an exponent
// (1e-7 <= |x| < 1e21), which covers every price, volume, and timestamp.
[[nodiscard]] std::string checksum_candles(std::span<const Candle> candles);

}  // namespace quant
