# Indicators and market-microstructure calculations

`quant.term` calculates research indicators in the browser from public market observations. They are descriptive tools, not audited trading signals.

## Technical indicators

| Calculation | Default | Output |
|---|---:|---|
| SMA | 20 periods | Arithmetic moving average |
| EMA | 12 periods | Exponentially weighted moving average |
| RSI | 14 periods | Wilder-style momentum oscillator |
| Bollinger Bands | 20 periods, 2σ | Middle, upper, and lower bands |
| MACD | 12 / 26 / 9 | MACD, signal, and histogram |
| ATR | 14 periods | Wilder-style average true range |
| VWAP | Session input | Cumulative volume-weighted price |
| OBV | — | Cumulative signed volume |
| ADX | 14 periods | Directional-trend strength |
| Hurst exponent | Full input window | Rescaled-range persistence estimate |

Implementations live in `src/utils/indicators.ts`. Inputs use the shared `OHLCV` contract and invalid/insufficient series return bounded empty or neutral outputs rather than fabricated values.

## Order-flow calculations

- **OFI:** compares changes in best-level bid and ask size between depth snapshots.
- **Volume delta / CVD:** classifies aggregate trades from the exchange taker flag and accumulates buy minus sell volume.
- **VPIN:** groups classified volume into equal-volume buckets and averages absolute buy/sell imbalance over a rolling window.
- **Depth heatmap:** bins bounded order-book snapshots by time and price for chart rendering.

The OFI and DOM panels currently own separate partial-depth subscriptions. Consolidating those consumers behind a shared depth registry is tracked in [ROADMAP.md](../ROADMAP.md).

## Calculation conventions

- Timestamps come from exchange payloads where available.
- No forward-looking candle is introduced into historical indicator windows.
- Numeric parsers reject non-finite provider values.
- Bounded stores prevent unbounded chart and depth history growth.
- Tests use explicit fixtures for core boundary cases.

## Validation status

The suite covers moving averages, RSI, MACD, Bollinger Bands, ATR, VWAP, OBV, ADX, Hurst, trade classification, OFI, VPIN overflow, and malformed upstream data. The project does **not** claim independent Bloomberg, TradingView, or exchange-certified parity. Any change to a formula should include:

1. a cited formula or primary reference,
2. deterministic fixtures with known results,
3. edge cases for empty, short, flat, and non-finite input,
4. an explanation of initialization and smoothing conventions.
