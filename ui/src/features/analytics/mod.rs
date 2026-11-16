//! Analytics panels — port of `src/features/analytics/*`.
//! REST polling (Alpha factors, Quant Signal) reuses `features::backtest::klines`
//! and `services::rest`; the live microstructure feeds are dedicated WebSocket
//! modules (`trade_feed` for `@aggTrade`, `book_feed` for `@depth20`).
//! All submodules need browser fetch/WebSocket APIs → wasm32 only.

#[cfg(target_arch = "wasm32")]
pub mod alpha_panel;
#[cfg(target_arch = "wasm32")]
pub mod book_feed;
#[cfg(target_arch = "wasm32")]
pub mod ofi;
#[cfg(target_arch = "wasm32")]
pub mod quant_signal;
#[cfg(target_arch = "wasm32")]
pub mod trade_feed;
#[cfg(target_arch = "wasm32")]
pub mod vpin;
#[cfg(target_arch = "wasm32")]
pub mod volume_delta;
