//! Port of `src/features/charts/HeatmapStrip.tsx` plus the heatmap
//! aggregation that `chartDataStore.buildHeatmap` delegated to
//! `quant-core::aggregate_order_book_heatmap`. The aggregation math is
//! reimplemented inline (it is ~60 lines) to avoid a JsValue round-trip.

use std::collections::HashMap;

use leptos::prelude::*;
use wasm_bindgen::JsCast;
use web_sys::{window, HtmlCanvasElement};

use crate::stores::{now_ms, OrderBookSnapshot};

use super::TimeRange;

const BID_COLOR: &str = "34, 197, 94";
const ASK_COLOR: &str = "239, 68, 68";

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct HeatmapBinConfig {
    pub time_bin_seconds: f64,
    pub price_bin_size: f64,
    pub time_window_minutes: f64,
    pub max_price_levels: Option<u32>,
}

impl Default for HeatmapBinConfig {
    fn default() -> Self {
        Self {
            time_bin_seconds: 10.0,
            price_bin_size: 0.5,
            time_window_minutes: 15.0,
            max_price_levels: None,
        }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct HeatmapCell {
    pub time: f64,
    pub price: f64,
    pub bid_size: f64,
    pub ask_size: f64,
    pub total_size: f64,
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct HeatmapResult {
    pub cells: Vec<HeatmapCell>,
    pub max_bid_size: f64,
    pub max_ask_size: f64,
    pub is_empty: bool,
}

/// Mirror of `quant_core::aggregate_order_book_heatmap` (rust/src/lib.rs).
/// `snapshots` should already be the symbol-filtered buffer; `now` is ms.
pub fn aggregate_heatmap(
    symbol: &str,
    snapshots: &[OrderBookSnapshot],
    config: &HeatmapBinConfig,
    now: f64,
) -> HeatmapResult {
    let empty = || HeatmapResult {
        cells: Vec::new(),
        max_bid_size: 0.0,
        max_ask_size: 0.0,
        is_empty: true,
    };

    let (tb, pb, tw) = (
        config.time_bin_seconds,
        config.price_bin_size,
        config.time_window_minutes,
    );
    if !(tb.is_finite() && tb > 0.0 && pb.is_finite() && pb > 0.0 && tw.is_finite() && tw > 0.0) {
        return empty();
    }

    let start_time = now - tw * 60_000.0;
    let time_bin_ms = tb * 1000.0;

    let relevant: Vec<&OrderBookSnapshot> = snapshots
        .iter()
        .filter(|s| s.symbol == symbol && s.timestamp >= start_time)
        .collect();
    if relevant.is_empty() {
        return empty();
    }

    // HashMap key mirrors quant-core's (time_bin.to_bits(), price_bin.to_bits()).
    let mut cell_map: HashMap<(u64, u64), HeatmapCell> = HashMap::new();
    for snap in relevant {
        let time_bin = (snap.timestamp / time_bin_ms).floor() * time_bin_ms;
        let mut process = |levels: &[(f64, f64)], is_bid: bool| {
            for (index, (price, size)) in levels.iter().enumerate() {
                if !price.is_finite() || !size.is_finite() || *size <= 0.0 {
                    continue;
                }
                if let Some(max) = config.max_price_levels {
                    if index as u32 >= max {
                        continue;
                    }
                }
                let price_bin = (*price / pb).floor() * pb;
                let key = (
                    if time_bin == 0.0 { 0.0 } else { time_bin }.to_bits(),
                    if price_bin == 0.0 { 0.0 } else { price_bin }.to_bits(),
                );
                cell_map
                    .entry(key)
                    .and_modify(|c| {
                        if is_bid {
                            c.bid_size += size;
                        } else {
                            c.ask_size += size;
                        }
                        c.total_size += size;
                    })
                    .or_insert(HeatmapCell {
                        time: time_bin,
                        price: price_bin,
                        bid_size: if is_bid { *size } else { 0.0 },
                        ask_size: if is_bid { 0.0 } else { *size },
                        total_size: *size,
                    });
            }
        };
        process(&snap.bids, true);
        process(&snap.asks, false);
    }

    let mut cells: Vec<HeatmapCell> = cell_map.into_values().collect();
    cells.sort_by(|a, b| {
        a.time
            .partial_cmp(&b.time)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then(a.price.partial_cmp(&b.price).unwrap_or(std::cmp::Ordering::Equal))
    });
    let max_bid = cells.iter().map(|c| c.bid_size).fold(0.0, f64::max);
    let max_ask = cells.iter().map(|c| c.ask_size).fold(0.0, f64::max);
    let is_empty = cells.is_empty();
    HeatmapResult {
        cells,
        max_bid_size: max_bid,
        max_ask_size: max_ask,
        is_empty,
    }
}

fn median_gap(values: &[f64]) -> f64 {
    if values.len() < 2 {
        return 0.0;
    }
    let mut gaps: Vec<f64> = values.windows(2).map(|w| w[1] - w[0]).collect();
    gaps.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    gaps.get(gaps.len() / 2).copied().unwrap_or(0.0)
}

fn canvas_2d(canvas: &HtmlCanvasElement) -> Option<web_sys::CanvasRenderingContext2d> {
    canvas
        .get_context("2d")
        .ok()
        .flatten()?
        .dyn_into::<web_sys::CanvasRenderingContext2d>()
        .ok()
}

#[cfg(target_arch = "wasm32")]
fn css_text_secondary() -> String {
    web_sys::window()
        .and_then(|w| {
            let el = w.document()?.document_element()?;
            w.get_computed_style(&el).ok().flatten()
        })
        .and_then(|s| s.get_property_value("--text-secondary").ok())
        .map(|v| {
            let t = v.trim();
            if t.is_empty() {
                "#94a3b8".to_string()
            } else {
                t.to_string()
            }
        })
        .unwrap_or_else(|| "#94a3b8".to_string())
}

#[cfg(not(target_arch = "wasm32"))]
fn css_text_secondary() -> String {
    "#94a3b8".to_string()
}

#[cfg(target_arch = "wasm32")]
fn device_pixel_ratio() -> f64 {
    window().map(|w| w.device_pixel_ratio()).unwrap_or(1.0)
}

#[cfg(not(target_arch = "wasm32"))]
fn device_pixel_ratio() -> f64 {
    1.0
}

/// Slim depth-liquidity strip synced to the chart's visible time window.
/// Purely presentational: consumes the shared heatmap aggregation plus the
/// chart's visible range so pan/zoom moves the strip in lockstep.
#[component]
pub fn HeatmapStrip(
    heatmap: Memo<Option<HeatmapResult>>,
    visible_range: Memo<Option<TimeRange>>,
    height: f64,
) -> impl IntoView {
    let canvas_ref = NodeRef::<leptos::html::Canvas>::new();
    let width = RwSignal::new(0.0f64);
    let height_px = if height.is_finite() && height > 0.0 {
        height
    } else {
        72.0
    };

    // No ResizeObserver in web-sys features — measure on mount and on
    // window resize (same limitation noted for the main chart).
    Effect::new(move |_| {
        let measure = move || {
            if let Some(canvas) = canvas_ref.get() {
                width.set(canvas.client_width() as f64);
            }
        };
        measure();
        #[cfg(target_arch = "wasm32")]
        {
            let cb = wasm_bindgen::closure::Closure::<dyn FnMut()>::new(move || measure());
            if let Some(w) = window() {
                let _ = w.add_event_listener_with_callback("resize", cb.as_ref().unchecked_ref());
            }
            cb.forget();
        }
    });

    // Draw whenever inputs or size change.
    Effect::new(move |_| {
        let w = {
            let measured = width.get();
            // Fallback for the first frame before layout settles.
            if measured > 0.0 {
                measured
            } else {
                canvas_ref
                    .get()
                    .map(|c| c.client_width() as f64)
                    .unwrap_or(0.0)
            }
        };
        let hm = heatmap.get();
        let range = visible_range.get();
        let Some(canvas) = canvas_ref.get() else {
            return;
        };
        if w <= 0.0 {
            return;
        }
        let Some(ctx) = canvas_2d(&canvas) else {
            return;
        };

        let dpr = device_pixel_ratio();
        let pw = (w * dpr).floor() as u32;
        let ph = (height_px * dpr).floor() as u32;
        if canvas.width() != pw || canvas.height() != ph {
            canvas.set_width(pw.max(1));
            canvas.set_height(ph.max(1));
            let style = web_sys::HtmlElement::style(&canvas);
            let _ = style.set_property("width", &format!("{w}px"));
            let _ = style.set_property("height", &format!("{height_px}px"));
        }
        let _ = ctx.set_transform(dpr, 0.0, 0.0, dpr, 0.0, 0.0);
        ctx.clear_rect(0.0, 0.0, w, height_px);

        ctx.set_font("10px monospace");
        ctx.set_text_align("center");
        let _ = ctx.set_fill_style_str(&css_text_secondary());

        let Some(hm) = hm else {
            let _ = ctx.fill_text("depth heatmap warming up", w / 2.0, height_px / 2.0 + 3.0);
            return;
        };
        if hm.is_empty || hm.cells.is_empty() {
            let _ = ctx.fill_text("depth heatmap warming up", w / 2.0, height_px / 2.0 + 3.0);
            return;
        }

        let mut sorted_cells = hm.cells.clone();
        sorted_cells.sort_by(|a, b| {
            a.time
                .partial_cmp(&b.time)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        // NOTE: candle times are seconds while heatmap cell times are ms
        // (bin timestamps). The TS code compared them raw, which placed all
        // cells off-screen whenever a visible range was emitted; we convert
        // the range to ms here so the strip actually tracks the chart.
        let has_range = range.is_some_and(|r| r.to_time > r.from_time);
        let (from_time, to_time) = if let Some(r) = range.filter(|r| r.to_time > r.from_time) {
            (r.from_time * 1000.0, r.to_time * 1000.0)
        } else {
            (
                sorted_cells.first().map(|c| c.time).unwrap_or(0.0),
                sorted_cells
                    .last()
                    .map(|c| c.time + 1.0)
                    .unwrap_or(1.0),
            )
        };

        let mut prices: Vec<f64> = sorted_cells.iter().map(|c| c.price).collect();
        prices.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        prices.dedup_by(|a, b| (*a - *b).abs() < f64::EPSILON);
        let Some((&min_price, &max_price)) = prices.first().zip(prices.last()) else {
            return;
        };
        let price_span = (max_price - min_price).max(f64::EPSILON);

        let price_gap = median_gap(&prices);
        let band_height = ((price_gap / price_span) * (height_px - 4.0))
            .min(height_px / 3.0)
            .max(2.0);
        let mut times: Vec<f64> = sorted_cells.iter().map(|c| c.time).collect();
        times.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        times.dedup_by(|a, b| (*a - *b).abs() < f64::EPSILON);
        let time_gap = median_gap(&times);
        let band_width = if has_range {
            ((time_gap / (to_time - from_time).max(1.0)) * w)
                .min(w / 2.0)
                .max(1.0)
        } else {
            (w / sorted_cells.len().max(1) as f64).max(2.0)
        };

        let max_intensity = hm.max_bid_size.max(hm.max_ask_size).max(f64::EPSILON);

        for (index, cell) in sorted_cells.iter().enumerate() {
            let x = if has_range {
                ((cell.time - from_time) / (to_time - from_time).max(1.0)) * w
            } else {
                (index as f64 / (sorted_cells.len().saturating_sub(1).max(1) as f64)) * w
            };
            if x < -band_width || x > w + band_width {
                continue;
            }
            let y_center = height_px - 2.0 - ((cell.price - min_price) / price_span) * (height_px - 4.0);
            let intensity = cell.bid_size.max(cell.ask_size) / max_intensity;
            let rgb = if cell.bid_size >= cell.ask_size {
                BID_COLOR
            } else {
                ASK_COLOR
            };
            ctx.set_fill_style_str(&format!(
                "rgba({rgb}, {:.3})",
                (intensity * 0.55).min(1.0)
            ));
            ctx.fill_rect(
                x - band_width / 2.0,
                y_center - band_height / 2.0,
                band_width,
                band_height,
            );
        }
    });

    view! {
        <div class="chart-heatmap-strip" style=format!("width: 100%; height: {height_px}px") aria-hidden="true">
            <canvas node_ref=canvas_ref style="display: block"></canvas>
        </div>
    }
}

/// Convenience: build a `HeatmapResult` from the store snapshot buffer.
pub fn build_heatmap(
    stores: &crate::stores::AppStores,
    symbol: &str,
) -> Option<HeatmapResult> {
    let snaps = stores.ob_snapshots.get_untracked();
    if snaps.is_empty() {
        return None;
    }
    Some(aggregate_heatmap(
        &symbol.to_uppercase(),
        &snaps,
        &HeatmapBinConfig::default(),
        now_ms(),
    ))
}
