//! Strategy Lab + backtest UI — port of `src/features/backtest/*`.
//! The engine itself lives in `quant-core` (`quant_core::typed`); this module
//! owns the dataset plumbing (fixture, Binance REST klines) and the views.
//! All submodules need browser fetch/WebSocket APIs → wasm32 only.

#[cfg(target_arch = "wasm32")]
pub mod equity_curve;
#[cfg(target_arch = "wasm32")]
pub mod format;
#[cfg(target_arch = "wasm32")]
pub mod klines;
#[cfg(target_arch = "wasm32")]
pub mod strategy_lab;
