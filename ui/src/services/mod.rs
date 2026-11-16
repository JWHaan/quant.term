//! Runtime services — provenance, telemetry and market-data feeds.
//! `provenance` and `telemetry` are pure logic (native-safe);
//! `binance_feed` needs browser WebSocket/timer APIs (wasm only).

pub mod provenance;
pub mod telemetry;

#[cfg(target_arch = "wasm32")]
pub mod binance_feed;
#[cfg(target_arch = "wasm32")]
pub mod hooks;
#[cfg(target_arch = "wasm32")]
pub mod news;
#[cfg(target_arch = "wasm32")]
pub mod rest;
