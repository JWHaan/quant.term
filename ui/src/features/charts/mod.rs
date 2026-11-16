//! Chart feature — canvas-based port of TerminalChart / ChartContainer /
//! HeatmapStrip (lightweight-charts has no Rust/WASM equivalent).

mod canvas_chart;
mod chart_container;
mod chart_theme;
mod data_quality;
mod heatmap;

pub use canvas_chart::{IndicatorToggles, TerminalChart};
pub use chart_container::ChartContainer;
pub use chart_theme::ChartTheme;
pub use data_quality::DataQualityBadge;
pub use heatmap::{
    aggregate_heatmap, build_heatmap, HeatmapBinConfig, HeatmapCell, HeatmapResult, HeatmapStrip,
};

/// Visible candle time window emitted by `TerminalChart`.
/// Times are in candle-time units (seconds since epoch), matching `Ohlcv.time`.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct TimeRange {
    pub from_time: f64,
    pub to_time: f64,
}
