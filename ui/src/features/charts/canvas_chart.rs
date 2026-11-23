//! Port of `src/features/charts/TerminalChart.tsx`.
//!
//! lightweight-charts has no Rust/WASM equivalent, so this renders the same
//! visual structure (candles + volume pane, EMA overlays, MACD & RSI panes,
//! crosshair, dark theme) directly on a CanvasRenderingContext2d.

use leptos::prelude::*;
use wasm_bindgen::JsCast;
use web_sys::{window, HtmlCanvasElement};

use crate::stores::Ohlcv;

use super::chart_theme::{resolve_chart_theme, ChartTheme};
use super::TimeRange;

pub const RSI_PANE_HEIGHT_PX: f64 = 90.0;
pub const MACD_PANE_HEIGHT_PX: f64 = 110.0;

const AXIS_W: f64 = 64.0;
const TIME_AXIS_H: f64 = 22.0;
const VOLUME_FRACTION: f64 = 0.2;

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct IndicatorToggles {
    pub ema9: bool,
    pub ema21: bool,
    pub macd: bool,
    pub rsi: bool,
}

#[derive(Clone, Copy, Debug, PartialEq)]
struct IndicatorPoint {
    time: f64,
    value: f64,
}

#[derive(Clone, Copy, Debug, PartialEq)]
struct MacdPoint {
    time: f64,
    macd: f64,
    signal: f64,
    histogram: f64,
}

#[derive(Clone, Debug, Default, PartialEq)]
struct IndicatorSet {
    ema9: Vec<IndicatorPoint>,
    ema21: Vec<IndicatorPoint>,
    macd: Vec<MacdPoint>,
    rsi: Vec<IndicatorPoint>,
}

#[derive(Clone, Copy, Debug, PartialEq)]
struct Hover {
    /// Candle index under the cursor.
    index: usize,
    /// Mouse Y position in canvas CSS pixels.
    y: f64,
}

/// Fractional candle window: `start` is the first visible candle index,
/// `visible` the number of bars on screen. Fractional values give smooth
/// pan/zoom; both are clamped to the dataset on every change.
#[derive(Clone, Copy, Debug, PartialEq)]
struct View {
    start: f64,
    visible: f64,
}

/// Drag-pan state captured on pointerdown.
#[derive(Clone, Copy, Debug, PartialEq)]
struct DragState {
    start_x: f64,
    view_start: f64,
}

/// Deepest zoom-in: at least this many bars on screen.
const MIN_VISIBLE_BARS: f64 = 10.0;
/// Panning past the edge keeps this many bars on screen.
const OVERLAP_BARS: f64 = 2.0;
/// Multiplicative zoom step for buttons and a unit of wheel delta.
const ZOOM_STEP: f64 = 1.25;
/// Bars shown on first load and after a reset.
const DEFAULT_VISIBLE_BARS: f64 = 120.0;

/// Clamp a requested window to the dataset: zoom can't go below
/// MIN_VISIBLE_BARS or past the full series; panning keeps OVERLAP_BARS
/// of data inside the viewport.
fn clamp_view(v: View, n: usize) -> View {
    let nf = n.max(1) as f64;
    let visible = v.visible.clamp(MIN_VISIBLE_BARS.min(nf), nf);
    let overlap = OVERLAP_BARS.min(visible).min(nf);
    let lo = -(visible - overlap);
    let hi = (nf - overlap).max(lo);
    View {
        start: v.start.clamp(lo, hi),
        visible,
    }
}

// ─── Indicator math (ports of quant-core algorithms used by the TS app) ──────

fn calc_ema(candles: &[Ohlcv], period: usize) -> Vec<IndicatorPoint> {
    if period == 0 || candles.len() < period {
        return Vec::new();
    }
    let k = 2.0 / (period as f64 + 1.0);
    let mut ema: f64 = candles[..period].iter().map(|c| c.close).sum::<f64>() / period as f64;
    let mut out = Vec::with_capacity(candles.len() - period + 1);
    out.push(IndicatorPoint {
        time: candles[period - 1].time,
        value: ema,
    });
    for c in &candles[period..] {
        ema = c.close * k + ema * (1.0 - k);
        out.push(IndicatorPoint {
            time: c.time,
            value: ema,
        });
    }
    out
}

fn calc_rsi(candles: &[Ohlcv], period: usize) -> Vec<IndicatorPoint> {
    if period == 0 || candles.len() < period + 1 {
        return Vec::new();
    }
    let mut gains = 0.0f64;
    let mut losses = 0.0f64;
    for i in 1..=period {
        let change = candles[i].close - candles[i - 1].close;
        if change > 0.0 {
            gains += change;
        } else {
            losses += change.abs();
        }
    }
    let mut avg_gain = gains / period as f64;
    let mut avg_loss = losses / period as f64;
    let rs0 = if avg_loss == 0.0 {
        100.0
    } else {
        avg_gain / avg_loss
    };
    let mut out = Vec::with_capacity(candles.len() - period);
    out.push(IndicatorPoint {
        time: candles[period].time,
        value: 100.0 - (100.0 / (1.0 + rs0)),
    });
    for i in period + 1..candles.len() {
        let change = candles[i].close - candles[i - 1].close;
        let gain = if change > 0.0 { change } else { 0.0 };
        let loss = if change < 0.0 { change.abs() } else { 0.0 };
        avg_gain = (avg_gain * (period as f64 - 1.0) + gain) / period as f64;
        avg_loss = (avg_loss * (period as f64 - 1.0) + loss) / period as f64;
        let rs = if avg_loss == 0.0 {
            100.0
        } else {
            avg_gain / avg_loss
        };
        out.push(IndicatorPoint {
            time: candles[i].time,
            value: 100.0 - (100.0 / (1.0 + rs)),
        });
    }
    out
}

/// quant-core `ema_values`: seeded with the first value (no SMA warm-up).
fn ema_seeded(values: &[f64], period: usize) -> Vec<f64> {
    if values.is_empty() || period == 0 {
        return Vec::new();
    }
    let k = 2.0 / (period as f64 + 1.0);
    let mut ema = vec![values[0]];
    for i in 1..values.len() {
        ema.push(values[i] * k + ema[i - 1] * (1.0 - k));
    }
    ema
}

fn calc_macd(candles: &[Ohlcv]) -> Vec<MacdPoint> {
    const FAST: usize = 12;
    const SLOW: usize = 26;
    const SIGNAL: usize = 9;
    if candles.len() < SLOW + SIGNAL || FAST == 0 || SLOW == 0 || SIGNAL == 0 {
        return Vec::new();
    }
    let closes: Vec<f64> = candles.iter().map(|c| c.close).collect();
    let fast_ema = ema_seeded(&closes, FAST);
    let slow_ema = ema_seeded(&closes, SLOW);
    let mut macd_line: Vec<Option<f64>> = Vec::with_capacity(closes.len());
    for i in 0..closes.len() {
        if i >= SLOW - 1 && i < fast_ema.len() && i < slow_ema.len() {
            macd_line.push(Some(fast_ema[i] - slow_ema[i]));
        } else {
            macd_line.push(None);
        }
    }
    let valid_macd: Vec<f64> = macd_line.iter().flatten().copied().collect();
    let signal_line = ema_seeded(&valid_macd, SIGNAL);
    // ADR-0001: the signal EMA is seeded at the first valid MACD value and
    // emitted on the same candle index as the MACD line, so the signal begins
    // where the MACD line becomes valid (index `SLOW - 1`).
    let mut out = Vec::new();
    for i in 0..candles.len() {
        if let Some(macd) = macd_line[i] {
            let signal = signal_line[i + 1 - SLOW];
            out.push(MacdPoint {
                time: candles[i].time,
                macd,
                signal,
                histogram: macd - signal,
            });
        }
    }
    out
}

// ─── Formatting helpers (ports of chartDataMapping.ts) ──────────────────────

/// Port of `getPriceFormatConfig`: decimals used for axis labels.
fn price_decimals(price: f64) -> usize {
    if !price.is_finite() || price <= 0.0 {
        return 2;
    }
    if price < 0.0001 {
        8
    } else if price < 0.01 {
        6
    } else if price < 1.0 {
        4
    } else if price < 10.0 {
        3
    } else {
        2
    }
}

fn format_fixed_trim(value: f64, decimals: usize) -> String {
    if !value.is_finite() {
        return "—".to_string();
    }
    let s = format!("{:.*}", decimals, value);
    // Trim trailing zeros but keep at least one decimal for readability.
    if s.contains('.') {
        let trimmed = s.trim_end_matches('0').trim_end_matches('.');
        if trimmed.is_empty() || trimmed == "-" {
            "0".to_string()
        } else {
            trimmed.to_string()
        }
    } else {
        s
    }
}

/// `toLocaleString('en-US')`-style grouping for axis labels.
fn add_thousands(s: &str) -> String {
    let (neg, body) = match s.strip_prefix('-') {
        Some(rest) => ("-", rest),
        None => ("", s),
    };
    let (int_part, frac_part) = match body.split_once('.') {
        Some((i, f)) => (i, Some(f)),
        None => (body, None),
    };
    let mut grouped = String::with_capacity(int_part.len() + int_part.len() / 3 + 1);
    for (idx, ch) in int_part.chars().enumerate() {
        if idx > 0 && (int_part.len() - idx) % 3 == 0 {
            grouped.push(',');
        }
        grouped.push(ch);
    }
    match frac_part {
        Some(f) => format!("{neg}{grouped}.{f}"),
        None => format!("{neg}{grouped}"),
    }
}

fn format_price(value: f64, decimals: usize) -> String {
    add_thousands(&format_fixed_trim(value, decimals))
}

/// Port of TerminalChart's `formatNumber` for the sr-only summary.
fn format_number(value: Option<f64>) -> String {
    let Some(v) = value.filter(|v| v.is_finite()) else {
        return "—".to_string();
    };
    let resolved = if v.abs() < 0.0001 {
        8
    } else if v.abs() < 0.01 {
        6
    } else if v.abs() < 1.0 {
        4
    } else if v.abs() < 10.0 {
        3
    } else {
        2
    };
    add_thousands(&format!("{:.*}", resolved + 2, v))
}

/// 1-2-5 "nice" step for gridline spacing.
fn nice_step(raw: f64) -> f64 {
    if !raw.is_finite() || raw <= 0.0 {
        return 1.0;
    }
    let mag = 10f64.powf(raw.log10().floor());
    let norm = raw / mag;
    let nice = if norm < 1.5 {
        1.0
    } else if norm < 3.0 {
        2.0
    } else if norm < 7.0 {
        5.0
    } else {
        10.0
    };
    nice * mag
}

fn interval_seconds(interval: &str) -> f64 {
    // Char-based split avoids panicking on a non-boundary byte index.
    let mut chars = interval.chars();
    let Some(unit) = chars.next_back() else {
        return 60.0;
    };
    let num: f64 = chars.as_str().parse().unwrap_or(0.0);
    if !num.is_finite() || num <= 0.0 {
        return 60.0;
    }
    match unit {
        's' => num,
        'm' => num * 60.0,
        'h' => num * 3600.0,
        'd' => num * 86400.0,
        'w' => num * 604800.0,
        _ => num * 60.0,
    }
}

/// Format a candle timestamp (seconds) for the time axis.
fn format_time_label(t: f64, interval: &str) -> String {
    if !t.is_finite() {
        return String::new();
    }
    #[cfg(target_arch = "wasm32")]
    {
        let secs = interval_seconds(interval);
        let d = js_sys::Date::new(&wasm_bindgen::JsValue::from_f64(t * 1000.0));
        let (h, m) = (d.get_utc_hours(), d.get_utc_minutes());
        let (mo, day) = (d.get_utc_month() + 1, d.get_utc_date());
        if secs >= 86400.0 {
            format!("{mo:02}-{day:02}")
        } else {
            format!("{h:02}:{m:02}")
        }
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        let _ = interval;
        format!("{}", t as i64)
    }
}

// ─── Canvas plumbing ─────────────────────────────────────────────────────────

fn canvas_2d(canvas: &HtmlCanvasElement) -> Option<web_sys::CanvasRenderingContext2d> {
    canvas
        .get_context("2d")
        .ok()
        .flatten()?
        .dyn_into::<web_sys::CanvasRenderingContext2d>()
        .ok()
}

#[cfg(target_arch = "wasm32")]
fn device_pixel_ratio() -> f64 {
    window().map(|w| w.device_pixel_ratio()).unwrap_or(1.0)
}

#[cfg(not(target_arch = "wasm32"))]
fn device_pixel_ratio() -> f64 {
    1.0
}

fn set_style(ctx: &web_sys::CanvasRenderingContext2d, color: &str) {
    ctx.set_fill_style_str(color);
    ctx.set_stroke_style_str(color);
}

/// Manual dashed horizontal/vertical line (avoids set_line_dash JsValue API).
fn dashed_line(
    ctx: &web_sys::CanvasRenderingContext2d,
    x1: f64,
    y1: f64,
    x2: f64,
    y2: f64,
    dash: f64,
    gap: f64,
) {
    let dx = x2 - x1;
    let dy = y2 - y1;
    let len = (dx * dx + dy * dy).sqrt();
    if len <= 0.0 {
        return;
    }
    let ux = dx / len;
    let uy = dy / len;
    let mut pos = 0.0;
    let mut drawing = true;
    ctx.begin_path();
    while pos < len {
        let seg = if drawing { dash } else { gap };
        let next = (pos + seg).min(len);
        if drawing {
            ctx.move_to(x1 + ux * pos, y1 + uy * pos);
            ctx.line_to(x1 + ux * next, y1 + uy * next);
        }
        pos = next;
        drawing = !drawing;
    }
    ctx.stroke();
}

fn stroke_polyline(
    ctx: &web_sys::CanvasRenderingContext2d,
    points: &[(f64, f64)],
) {
    ctx.begin_path();
    let mut started = false;
    for &(x, y) in points {
        if !x.is_finite() || !y.is_finite() {
            started = false;
            continue;
        }
        if started {
            ctx.line_to(x, y);
        } else {
            ctx.move_to(x, y);
            started = true;
        }
    }
    ctx.stroke();
}

// ─── Main draw routine ───────────────────────────────────────────────────────

#[allow(clippy::too_many_arguments)]
fn draw_chart(
    canvas: &HtmlCanvasElement,
    candles: &[Ohlcv],
    indicators: &IndicatorSet,
    toggles: IndicatorToggles,
    theme: &ChartTheme,
    hover: Option<Hover>,
    css_w: f64,
    css_h: f64,
    interval: &str,
    view: View,
) {
    let ctx = match canvas_2d(canvas) {
        Some(c) => c,
        None => return,
    };
    if css_w <= 0.0 || css_h <= 0.0 {
        return;
    }

    let dpr = device_pixel_ratio();
    let pw = (css_w * dpr).floor().max(1.0) as u32;
    let ph = (css_h * dpr).floor().max(1.0) as u32;
    if canvas.width() != pw || canvas.height() != ph {
        canvas.set_width(pw);
        canvas.set_height(ph);
    }
    let _ = ctx.set_transform(dpr, 0.0, 0.0, dpr, 0.0, 0.0);

    // Background.
    ctx.set_fill_style_str(&theme.background);
    ctx.fill_rect(0.0, 0.0, css_w, css_h);

    let plot_w = (css_w - AXIS_W).max(1.0);
    let plot_h = (css_h - TIME_AXIS_H).max(1.0);

    let rsi_h = if toggles.rsi { RSI_PANE_HEIGHT_PX } else { 0.0 };
    let macd_h = if toggles.macd { MACD_PANE_HEIGHT_PX } else { 0.0 };
    let price_h = (plot_h - rsi_h - macd_h).max(40.0);
    let rsi_top = price_h;
    let macd_top = price_h + rsi_h;

    // ── Price scale (visible candle window + EMA overlays) ───────────────
    let n = candles.len();
    let view = clamp_view(view, n);
    let slot = plot_w / view.visible.max(1.0);
    let x_of = |i: usize| -> f64 { (i as f64 - view.start) * slot + slot / 2.0 };

    // Scales fit the visible window only — panning re-fits, zooming stretches.
    let i0 = view.start.floor().max(0.0) as usize;
    let i1 = ((view.start + view.visible).ceil() as usize)
        .min(n)
        .max(i0);
    let window = &candles[i0..i1];
    let (t0, t1) = match (window.first(), window.last()) {
        (Some(f), Some(l)) => (f.time, l.time),
        _ => (f64::NEG_INFINITY, f64::INFINITY),
    };

    let mut p_min = f64::INFINITY;
    let mut p_max = f64::NEG_INFINITY;
    let mut v_max = 0.0f64;
    for c in window {
        if c.low.is_finite() {
            p_min = p_min.min(c.low);
        }
        if c.high.is_finite() {
            p_max = p_max.max(c.high);
        }
        if c.volume.is_finite() {
            v_max = v_max.max(c.volume);
        }
    }
    if toggles.ema9 {
        for p in &indicators.ema9 {
            if p.value.is_finite() && p.time >= t0 && p.time <= t1 {
                p_min = p_min.min(p.value);
                p_max = p_max.max(p.value);
            }
        }
    }
    if toggles.ema21 {
        for p in &indicators.ema21 {
            if p.value.is_finite() && p.time >= t0 && p.time <= t1 {
                p_min = p_min.min(p.value);
                p_max = p_max.max(p.value);
            }
        }
    }
    if !p_min.is_finite() || !p_max.is_finite() || p_min >= p_max {
        p_min = 0.0;
        p_max = 1.0;
    }
    let pad = ((p_max - p_min) * 0.05).max(p_max.abs() * 0.0005).max(f64::EPSILON);
    p_min -= pad;
    p_max += pad;
    let y_of = |price: f64| -> f64 {
        price_h - ((price - p_min) / (p_max - p_min)) * price_h
    };

    // ── Grid + price axis ─────────────────────────────────────────────────
    ctx.set_line_width(1.0);
    ctx.set_stroke_style_str(&theme.grid_color);
    let step = nice_step((p_max - p_min) / 6.0);
    let decimals = price_decimals(candles.last().map(|c| c.close).unwrap_or(p_max));
    ctx.set_font("10px monospace");
    ctx.set_text_align("left");
    ctx.set_text_baseline("middle");
    let first_level = (p_min / step).ceil() * step;
    let mut level = first_level;
    while level <= p_max {
        let y = y_of(level);
        if y >= 0.0 && y <= price_h {
            ctx.begin_path();
            ctx.move_to(0.0, y);
            ctx.line_to(plot_w, y);
            ctx.stroke();
            set_style(&ctx, &theme.text_color);
            let _ = ctx.fill_text(&format_price(level, decimals), plot_w + 6.0, y);
            set_style(&ctx, &theme.grid_color);
            ctx.set_stroke_style_str(&theme.grid_color);
        }
        level += step;
        if level.is_infinite() || level.is_nan() {
            break;
        }
    }

    // Clip price-pane drawing to the plot rect — panned content must not
    // paint over the axes or sibling panes.
    ctx.save();
    ctx.begin_path();
    ctx.rect(0.0, 0.0, plot_w, price_h);
    ctx.clip();

    // ── Volume (bottom VOLUME_FRACTION of the price pane) ────────────────
    let vol_top = price_h * (1.0 - VOLUME_FRACTION);
    let vol_h = price_h * VOLUME_FRACTION;
    if n > 0 && v_max.is_finite() && v_max > 0.0 {
        let bar_w = (slot * 0.7).max(1.0);
        for (i, c) in candles.iter().enumerate() {
            if !c.volume.is_finite() || c.volume <= 0.0 {
                continue;
            }
            let h = (c.volume / v_max) * (vol_h - 2.0);
            let up = c.close >= c.open;
            set_style(&ctx, if up { &theme.up_color } else { &theme.down_color });
            ctx.fill_rect(
                x_of(i) - bar_w / 2.0,
                price_h - 1.0 - h,
                bar_w,
                h.max(1.0),
            );
        }
    }
    // Faint separator above the volume zone.
    ctx.set_stroke_style_str(&theme.border_color);
    ctx.begin_path();
    ctx.move_to(0.0, vol_top);
    ctx.line_to(plot_w, vol_top);
    ctx.stroke();

    // ── Candlesticks ──────────────────────────────────────────────────────
    if n > 0 {
        let body_w = (slot * 0.7).max(1.0).min(slot.max(1.0));
        for (i, c) in candles.iter().enumerate() {
            if !(c.open.is_finite()
                && c.high.is_finite()
                && c.low.is_finite()
                && c.close.is_finite())
            {
                continue;
            }
            let up = c.close >= c.open;
            set_style(&ctx, if up { &theme.up_color } else { &theme.down_color });
            let cx = x_of(i);
            let y_hi = y_of(c.high);
            let y_lo = y_of(c.low);
            let y_o = y_of(c.open);
            let y_c = y_of(c.close);
            // Wick.
            ctx.set_line_width(1.0);
            ctx.begin_path();
            ctx.move_to(cx, y_hi);
            ctx.line_to(cx, y_lo);
            ctx.stroke();
            // Body.
            let top = y_o.min(y_c);
            let h = (y_o - y_c).abs().max(1.0);
            ctx.fill_rect(cx - body_w / 2.0, top, body_w, h);
        }
    }

    // ── EMA overlays (same price pane) ────────────────────────────────────
    ctx.set_line_width(1.0);
    let draw_line_series = |points: &[IndicatorPoint], color: &str| {
        if points.is_empty() {
            return;
        }
        // Binary-search candle index per point via time.
        let coords: Vec<(f64, f64)> = points
            .iter()
            .filter(|p| p.value.is_finite() && p.time.is_finite())
            .filter_map(|p| {
                let idx = candles
                    .binary_search_by(|c| {
                        c.time
                            .partial_cmp(&p.time)
                            .unwrap_or(std::cmp::Ordering::Equal)
                    })
                    .unwrap_or_else(|ins| ins.saturating_sub(1).min(n.saturating_sub(1)));
                if n == 0 {
                    return None;
                }
                Some((x_of(idx), y_of(p.value)))
            })
            .collect();
        ctx.set_stroke_style_str(color);
        stroke_polyline(&ctx, &coords);
    };
    if toggles.ema9 {
        draw_line_series(&indicators.ema9, &theme.ema9);
    }
    if toggles.ema21 {
        draw_line_series(&indicators.ema21, &theme.ema21);
    }
    ctx.restore();

    // ── Pane separators (top edge of each enabled indicator pane) ────────
    ctx.set_stroke_style_str(&theme.border_color);
    let mut sep_y = price_h;
    if toggles.rsi {
        if sep_y > 0.0 && sep_y < css_h {
            ctx.begin_path();
            ctx.move_to(0.0, sep_y);
            ctx.line_to(css_w, sep_y);
            ctx.stroke();
        }
        sep_y += rsi_h;
    }
    if toggles.macd {
        if sep_y > 0.0 && sep_y < css_h {
            ctx.begin_path();
            ctx.move_to(0.0, sep_y);
            ctx.line_to(css_w, sep_y);
            ctx.stroke();
        }
    }
    // Right price-axis spine.
    ctx.begin_path();
    ctx.move_to(css_w - AXIS_W, 0.0);
    ctx.line_to(css_w - AXIS_W, css_h);
    ctx.stroke();

    if toggles.rsi && !indicators.rsi.is_empty() {
        let r_top = rsi_top;
        let r_h = rsi_h;
        let mut lo = f64::INFINITY;
        let mut hi = f64::NEG_INFINITY;
        for p in &indicators.rsi {
            if p.value.is_finite() && p.time >= t0 && p.time <= t1 {
                lo = lo.min(p.value);
                hi = hi.max(p.value);
            }
        }
        if lo.is_finite() && hi.is_finite() {
            let span = (hi - lo).max(1.0);
            lo = (lo - span * 0.1).max(0.0);
            hi = (hi + span * 0.1).min(100.0);
            if hi <= lo {
                hi = lo + 1.0;
            }
            let ry = |v: f64| r_top + r_h - ((v - lo) / (hi - lo)) * r_h;
            ctx.save();
            ctx.begin_path();
            ctx.rect(0.0, r_top, plot_w, r_h);
            ctx.clip();
            // 30 / 70 dashed guides.
            ctx.set_stroke_style_str(&theme.crosshair_color);
            ctx.set_line_width(1.0);
            for &guide in &[30.0, 70.0] {
                let gy = ry(guide);
                dashed_line(&ctx, 0.0, gy, plot_w, gy, 4.0, 4.0);
            }
            // RSI line.
            let coords: Vec<(f64, f64)> = indicators
                .rsi
                .iter()
                .filter(|p| p.value.is_finite() && p.time.is_finite())
                .filter_map(|p| {
                    if n == 0 {
                        return None;
                    }
                    let idx = candles
                        .binary_search_by(|c| {
                            c.time
                                .partial_cmp(&p.time)
                                .unwrap_or(std::cmp::Ordering::Equal)
                        })
                        .unwrap_or_else(|ins| ins.saturating_sub(1).min(n.saturating_sub(1)));
                    Some((x_of(idx), ry(p.value)))
                })
                .collect();
            ctx.set_stroke_style_str(&theme.rsi);
            stroke_polyline(&ctx, &coords);
            ctx.restore();
        }
    }

    // ── MACD pane ─────────────────────────────────────────────────────────
    if toggles.macd && !indicators.macd.is_empty() {
        let m_top = macd_top;
        let m_h = macd_h;
        let mut max_abs = 0.0f64;
        for p in &indicators.macd {
            if p.time < t0 || p.time > t1 {
                continue;
            }
            if p.histogram.is_finite() {
                max_abs = max_abs.max(p.histogram.abs());
            }
            if p.macd.is_finite() {
                max_abs = max_abs.max(p.macd.abs());
            }
            if p.signal.is_finite() {
                max_abs = max_abs.max(p.signal.abs());
            }
        }
        if max_abs <= 0.0 || !max_abs.is_finite() {
            max_abs = 1.0;
        }
        max_abs *= 1.1;
        let zero_y = m_top + m_h / 2.0;
        let my = |v: f64| zero_y - (v / max_abs) * (m_h / 2.0);
        ctx.save();
        ctx.begin_path();
        ctx.rect(0.0, m_top, plot_w, m_h);
        ctx.clip();
        // Zero line.
        ctx.set_stroke_style_str(&theme.border_color);
        ctx.begin_path();
        ctx.move_to(0.0, zero_y);
        ctx.line_to(plot_w, zero_y);
        ctx.stroke();
        // Histogram.
        let bar_w = (slot * 0.6).max(1.0);
        for p in &indicators.macd {
            if !p.histogram.is_finite() || n == 0 {
                continue;
            }
            let idx = candles
                .binary_search_by(|c| {
                    c.time
                        .partial_cmp(&p.time)
                        .unwrap_or(std::cmp::Ordering::Equal)
                })
                .unwrap_or_else(|ins| ins.saturating_sub(1).min(n.saturating_sub(1)));
            let cx = x_of(idx);
            let y = my(p.histogram);
            let h = (zero_y - y).abs().max(1.0);
            let top = y.min(zero_y);
            // Theme up/down colors at reduced alpha, like `${color}99`.
            let base = if p.histogram >= 0.0 {
                theme.up_color.clone()
            } else {
                theme.down_color.clone()
            };
            set_style(&ctx, &with_alpha(&base, 0.6));
            ctx.fill_rect(cx - bar_w / 2.0, top, bar_w, h);
        }
        // MACD + signal lines.
        let line_coords = |pick: fn(&MacdPoint) -> f64, color: &str| {
            let coords: Vec<(f64, f64)> = indicators
                .macd
                .iter()
                .filter(|p| pick(p).is_finite() && p.time.is_finite())
                .filter_map(|p| {
                    let idx = candles
                        .binary_search_by(|c| {
                            c.time
                                .partial_cmp(&p.time)
                                .unwrap_or(std::cmp::Ordering::Equal)
                        })
                        .unwrap_or_else(|ins| ins.saturating_sub(1).min(n.saturating_sub(1)));
                    if n == 0 {
                        return None;
                    }
                    Some((x_of(idx), my(pick(p))))
                })
                .collect();
            ctx.set_stroke_style_str(color);
            stroke_polyline(&ctx, &coords);
        };
        line_coords(|p| p.macd, &theme.macd);
        line_coords(|p| p.signal, &theme.signal);
        ctx.restore();
    }

    // ── Time axis ─────────────────────────────────────────────────────────
    if n > 0 {
        let axis_y = css_h - TIME_AXIS_H / 2.0;
        set_style(&ctx, &theme.text_color);
        ctx.set_font("10px monospace");
        ctx.set_text_align("center");
        ctx.set_text_baseline("middle");
        let label_count = 6usize;
        let span = (i1 - i0).max(1);
        for k in 0..label_count {
            let idx = (i0 + ((k as f64 + 0.5) / label_count as f64 * span as f64) as usize)
                .min(i1 - 1)
                .min(n - 1);
            let x = x_of(idx).min(plot_w - 8.0);
            let _ = ctx.fill_text(&format_time_label(candles[idx].time, interval), x, axis_y);
        }
    }

    // ── Crosshair ─────────────────────────────────────────────────────────
    if let Some(h) = hover {
        let cx = x_of(h.index).min(plot_w);
        let cy = if h.y.is_finite() {
            h.y.clamp(0.0, css_h)
        } else {
            0.0
        };
        ctx.set_line_width(1.0);
        ctx.set_stroke_style_str(&theme.crosshair_color);
        ctx.begin_path();
        ctx.move_to(cx, 0.0);
        ctx.line_to(cx, css_h);
        ctx.stroke();
        ctx.begin_path();
        ctx.move_to(0.0, cy);
        ctx.line_to(plot_w, cy);
        ctx.stroke();
        // Price label on the right axis.
        if cy <= price_h && h.index < n {
            let price = p_max - ((cy / price_h) * (p_max - p_min));
            set_style(&ctx, &theme.crosshair_color);
            ctx.set_font("10px monospace");
            ctx.set_text_align("left");
            let label = format_price(price, decimals);
            let _ = ctx.fill_text(&label, plot_w + 4.0, cy);
        }
        // Time label on the bottom axis.
        if h.index < n {
            set_style(&ctx, &theme.crosshair_color);
            ctx.set_text_align("center");
            let label = format_time_label(candles[h.index].time, interval);
            let _ = ctx.fill_text(&label, cx.clamp(20.0, plot_w - 20.0), css_h - TIME_AXIS_H / 2.0);
        }
    }
}

/// `#rrggbb` → `rgba(r,g,b,alpha)`; other formats pass through unchanged.
fn with_alpha(color: &str, alpha: f64) -> String {
    let hex = color.trim().trim_start_matches('#');
    if hex.len() == 6 && hex.chars().all(|c| c.is_ascii_hexdigit()) {
        let r = u8::from_str_radix(&hex[0..2], 16).unwrap_or(0);
        let g = u8::from_str_radix(&hex[2..4], 16).unwrap_or(0);
        let b = u8::from_str_radix(&hex[4..6], 16).unwrap_or(0);
        format!("rgba({r}, {g}, {b}, {alpha})")
    } else {
        color.to_string()
    }
}

// ─── Component ───────────────────────────────────────────────────────────────

/// Owns the window `resize` listener, `ResizeObserver` and settle-tick timer
/// the redraw effect registers; dropping removes/disconnects them so they
/// cannot fire on disposed signals after the chart unmounts.
#[cfg(target_arch = "wasm32")]
struct ChartListeners {
    resize_cb: wasm_bindgen::closure::Closure<dyn FnMut()>,
    observer: Option<(
        wasm_bindgen::JsValue,
        wasm_bindgen::closure::Closure<dyn FnMut(js_sys::Array)>,
    )>,
    settle_timer: i32,
    _settle_cb: wasm_bindgen::closure::Closure<dyn FnMut()>,
}

#[cfg(target_arch = "wasm32")]
impl Drop for ChartListeners {
    fn drop(&mut self) {
        if let Some(w) = window() {
            let _ = w.remove_event_listener_with_callback(
                "resize",
                self.resize_cb.as_ref().unchecked_ref(),
            );
            if self.settle_timer != 0 {
                w.clear_timeout_with_handle(self.settle_timer);
            }
        }
        if let Some((observer, _)) = &self.observer {
            if let Ok(disconnect) = js_sys::Reflect::get(observer, &"disconnect".into()) {
                if let Ok(disconnect) = disconnect.dyn_into::<js_sys::Function>() {
                    let _ = disconnect.call0(observer);
                }
            }
        }
    }
}

/// Port of `TerminalChart`. All heavy lifting happens in `draw_chart`, which
/// re-runs whenever candles, toggles, size or hover change.
#[component]
pub fn TerminalChart(
    symbol: Memo<String>,
    interval: Memo<String>,
    candles: Memo<Vec<Ohlcv>>,
    is_loading: Memo<bool>,
    error: Memo<Option<String>>,
    is_connected: Memo<bool>,
    indicator_toggles: RwSignal<IndicatorToggles>,
    on_visible_range_change: impl Fn(Option<TimeRange>) + Copy + Send + Sync + 'static,
) -> impl IntoView {
    let canvas_ref = NodeRef::<leptos::html::Canvas>::new();
    let hover = RwSignal::new(None::<Hover>);
    let tick = RwSignal::new(0u32);

    let sorted = Memo::new(move |_| {
        let mut c = candles.get();
        c.sort_by(|a, b| {
            a.time
                .partial_cmp(&b.time)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        c
    });

    let indicators = Memo::new(move |_| {
        let t = indicator_toggles.get();
        let c = sorted.get();
        IndicatorSet {
            ema9: if t.ema9 && c.len() >= 9 {
                calc_ema(&c, 9)
            } else {
                Vec::new()
            },
            ema21: if t.ema21 && c.len() >= 21 {
                calc_ema(&c, 21)
            } else {
                Vec::new()
            },
            macd: if t.macd && c.len() >= 35 {
                calc_macd(&c)
            } else {
                Vec::new()
            },
            rsi: if t.rsi && c.len() >= 15 {
                calc_rsi(&c, 14)
            } else {
                Vec::new()
            },
        }
    });

    // Viewport: `start` = left-edge candle index (fractional for smooth
    // pan/zoom), `visible` = bars on screen. `follow` pins the right edge to
    // live candles until the user navigates away; reset restores it.
    let view = RwSignal::new(View {
        start: 0.0,
        visible: DEFAULT_VISIBLE_BARS,
    });
    let follow = RwSignal::new(true);
    let drag = RwSignal::new(None::<DragState>);

    // Zoom around the plot center (the +/- buttons).
    let zoom_at_center = move |factor: f64| {
        let n = sorted.with(|c| c.len());
        if n == 0 {
            return;
        }
        let v0 = view.get_untracked();
        let anchor = v0.start + v0.visible * 0.5;
        let visible = v0.visible * factor;
        view.set(clamp_view(
            View {
                start: anchor - visible * 0.5,
                visible,
            },
            n,
        ));
        follow.set(false);
    };

    // Back to the live edge at the default zoom.
    let reset_view = move || {
        let n = sorted.with(|c| c.len());
        follow.set(true);
        let v = clamp_view(
            View {
                start: 0.0,
                visible: DEFAULT_VISIBLE_BARS,
            },
            n,
        );
        view.set(View {
            start: (n as f64 - v.visible).max(0.0),
            ..v
        });
    };

    // Clamp the window whenever the series changes; while `follow` is on,
    // keep the right edge pinned to the newest candle.
    Effect::new(move |_| {
        let n = sorted.with(|c| c.len());
        let pinned = follow.get_untracked();
        view.update(|v| {
            let mut next = clamp_view(*v, n);
            if pinned {
                next.start = (n as f64 - next.visible).max(0.0);
            }
            if next != *v {
                *v = next;
            }
        });
    });

    // Emit the actually-visible candle window — drives the HeatmapStrip
    // range sync.
    Effect::new(move |_| {
        let c = sorted.get();
        let v = clamp_view(view.get(), c.len());
        let i0 = v.start.floor().max(0.0) as usize;
        let i1 = ((v.start + v.visible).ceil() as usize).min(c.len());
        match (i0 < i1, c.get(i0), c.get(i1.saturating_sub(1))) {
            (true, Some(first), Some(last)) => on_visible_range_change(Some(TimeRange {
                from_time: first.time,
                to_time: last.time,
            })),
            _ => on_visible_range_change(None),
        }
    });

    // Window + panel ResizeObserver → redraw tick.
    #[cfg(target_arch = "wasm32")]
    let listeners_slot = std::rc::Rc::new(std::cell::RefCell::new(None::<ChartListeners>));
    #[cfg(target_arch = "wasm32")]
    Effect::new(move |_| {
        let cb = wasm_bindgen::closure::Closure::<dyn FnMut()>::new(move || {
            tick.update(|t| *t = t.wrapping_add(1));
        });
        if let Some(w) = window() {
            let _ = w.add_event_listener_with_callback("resize", cb.as_ref().unchecked_ref());
        }

        let mut observer = None;
        if let Some(canvas) = canvas_ref.get() {
            let ro_cb = wasm_bindgen::closure::Closure::<dyn FnMut(js_sys::Array)>::new(move |_entries: js_sys::Array| {
                tick.update(|t| *t = t.wrapping_add(1));
            });
            if let Some(w) = window() {
                if let Ok(ro_val) = js_sys::Reflect::get(&w, &"ResizeObserver".into()) {
                    if let Ok(ro_ctor) = ro_val.dyn_into::<js_sys::Function>() {
                        if let Ok(ob) = js_sys::Reflect::construct(&ro_ctor, &js_sys::Array::of1(ro_cb.as_ref())) {
                            if let Ok(observe_fn) = js_sys::Reflect::get(&ob, &"observe".into()) {
                                if let Ok(observe_fn) = observe_fn.dyn_into::<js_sys::Function>() {
                                    let _ = observe_fn.call1(&ob, &canvas);
                                }
                            }
                            observer = Some((ob, ro_cb));
                        }
                    }
                }
            }
        }

        // One-shot delayed tick covers late layout / CSS settling.
        let cb2 = wasm_bindgen::closure::Closure::<dyn FnMut()>::new(move || {
            tick.update(|t| *t = t.wrapping_add(1));
        });
        let settle_timer = window()
            .and_then(|w| {
                w.set_timeout_with_callback_and_timeout_and_arguments_0(
                    cb2.as_ref().unchecked_ref(),
                    50,
                )
                .ok()
            })
            .unwrap_or(0);

        *listeners_slot.borrow_mut() = Some(ChartListeners {
            resize_cb: cb,
            observer,
            settle_timer,
            _settle_cb: cb2,
        });
    });

    // Redraw on any input change.
    Effect::new(move |_| {
        let _ = tick.get();
        let c = sorted.get();
        let ind = indicators.get();
        let t = indicator_toggles.get();
        let h = hover.get();
        let v = view.get();
        let intv = interval.get();
        let theme = resolve_chart_theme();
        let Some(canvas) = canvas_ref.get() else {
            return;
        };
        let w = canvas.client_width() as f64;
        let h_px = canvas.client_height() as f64;
        draw_chart(&canvas, &c, &ind, t, &theme, h, w, h_px, &intv, v);
    });

    view! {
        <div style="position: relative; width: 100%; height: 100%">
            <canvas
                node_ref=canvas_ref
                class="terminal-chart-canvas"
                style=move || {
                    let cursor = if drag.get().is_some() { "grabbing" } else { "crosshair" };
                    format!("display: block; width: 100%; height: 100%; touch-action: none; cursor: {cursor}")
                }
                role="img"
                aria-label=move || {
                    let c = sorted.with(|s| s.len());
                    format!("{} {} candlestick chart with {c} candles", symbol.get().to_uppercase(), interval.get())
                }
                tabindex="0"
                on:pointerdown=move |ev| {
                    if ev.button() != 0 {
                        return;
                    }
                    let Some(canvas) = canvas_ref.get() else { return };
                    let v0 = view.get_untracked();
                    drag.set(Some(DragState {
                        start_x: ev.client_x() as f64,
                        view_start: v0.start,
                    }));
                    let _ = canvas.set_pointer_capture(ev.pointer_id());
                }
                on:pointermove=move |ev| {
                    let Some(canvas) = canvas_ref.get() else { return };
                    let rect = canvas.get_bounding_client_rect();
                    let x = ev.client_x() as f64 - rect.left();
                    let y = ev.client_y() as f64 - rect.top();
                    let c = sorted.get_untracked();
                    let w = canvas.client_width() as f64;
                    if w <= AXIS_W {
                        hover.set(None);
                        return;
                    }
                    let plot_w = w - AXIS_W;
                    if let Some(d) = drag.get_untracked() {
                        // Pixels → candle indices: dragging left moves forward
                        // in time (the chart pans under a stationary cursor).
                        let v0 = view.get_untracked();
                        let slot = plot_w / v0.visible.max(1.0);
                        if slot.is_finite() && slot > 0.0 {
                            view.set(clamp_view(
                                View {
                                    start: d.view_start
                                        + (d.start_x - ev.client_x() as f64) / slot,
                                    ..v0
                                },
                                c.len(),
                            ));
                            follow.set(false);
                        }
                    }
                    if c.is_empty() {
                        hover.set(None);
                        return;
                    }
                    let v = view.get_untracked();
                    let idx = (v.start + x / plot_w * v.visible)
                        .floor()
                        .clamp(0.0, c.len() as f64 - 1.0) as usize;
                    if x >= 0.0 && x <= plot_w && y >= 0.0 {
                        hover.set(Some(Hover { index: idx, y }));
                    } else {
                        hover.set(None);
                    }
                }
                on:pointerup=move |ev| {
                    drag.set(None);
                    if let Some(canvas) = canvas_ref.get() {
                        let _ = canvas.release_pointer_capture(ev.pointer_id());
                    }
                }
                on:pointercancel=move |_| drag.set(None)
                on:pointerleave=move |_| hover.set(None)
                on:wheel=move |ev| {
                    let Some(canvas) = canvas_ref.get() else { return };
                    ev.prevent_default();
                    let n = sorted.with(|c| c.len());
                    if n == 0 {
                        return;
                    }
                    let rect = canvas.get_bounding_client_rect();
                    let x = ev.client_x() as f64 - rect.left();
                    let plot_w = (canvas.client_width() as f64 - AXIS_W).max(1.0);
                    // Keep the candle under the cursor anchored while zooming.
                    let frac = (x / plot_w).clamp(0.0, 1.0);
                    let v0 = view.get_untracked();
                    let anchor = v0.start + frac * v0.visible;
                    let dy = match ev.delta_mode() {
                        1 => ev.delta_y() * 16.0,
                        2 => ev.delta_y() * 400.0,
                        _ => ev.delta_y(),
                    };
                    let mag = (dy.abs() / 100.0).clamp(0.5, 3.0);
                    let factor = ZOOM_STEP.powf(if dy < 0.0 { -mag } else { mag });
                    let visible = v0.visible * factor;
                    view.set(clamp_view(
                        View {
                            start: anchor - frac * visible,
                            visible,
                        },
                        n,
                    ));
                    follow.set(false);
                }
                on:dblclick=move |ev| {
                    ev.prevent_default();
                    reset_view();
                }
            ></canvas>

            <div style="position: absolute; top: 8px; right: 72px; display: flex; gap: 4px; z-index: 2; font-family: var(--font-mono)">
                <button
                    type="button"
                    title="Zoom out"
                    aria-label="Zoom out"
                    style="width: 22px; height: 22px; padding: 0; border: 1px solid var(--border-color, #334155); background: var(--bg-elevated, #1e293b); color: var(--text-secondary, #94a3b8); font-size: 13px; line-height: 1; cursor: pointer; border-radius: 2px"
                    on:click=move |_| zoom_at_center(ZOOM_STEP)
                >
                    "−"
                </button>
                <button
                    type="button"
                    title="Zoom in"
                    aria-label="Zoom in"
                    style="width: 22px; height: 22px; padding: 0; border: 1px solid var(--border-color, #334155); background: var(--bg-elevated, #1e293b); color: var(--text-secondary, #94a3b8); font-size: 13px; line-height: 1; cursor: pointer; border-radius: 2px"
                    on:click=move |_| zoom_at_center(1.0 / ZOOM_STEP)
                >
                    "+"
                </button>
                <button
                    type="button"
                    title="Reset view to the live edge"
                    aria-label="Reset view to the live edge"
                    style="height: 22px; padding: 0 6px; border: 1px solid var(--border-color, #334155); background: var(--bg-elevated, #1e293b); color: var(--text-secondary, #94a3b8); font-size: 9px; letter-spacing: 0.5px; cursor: pointer; border-radius: 2px"
                    on:click=move |_| reset_view()
                >
                    {move || if follow.get() { "LIVE" } else { "RESET" }}
                </button>
            </div>

            {move || sorted.with(|c| c.is_empty()).then(|| {
                let err = error.get();
                let loading = is_loading.get();
                let sym = symbol.get();
                let intv = interval.get();
                view! {
                    <div
                        aria-live="polite"
                        style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; pointer-events: none; color: var(--text-secondary); font-family: var(--font-mono); font-size: 12px; text-align: center; background: var(--chart-bg, #0f172a)"
                    >
                        <div style="font-size: 14px">
                            {if err.is_some() {
                                "Chart data unavailable".to_string()
                            } else if loading {
                                "Loading chart data…".to_string()
                            } else {
                                "Awaiting live candles…".to_string()
                            }}
                        </div>
                        <div style="opacity: 0.7">
                            {err.unwrap_or_else(|| format!("Connecting to Binance Spot · {sym} · {intv}"))}
                        </div>
                    </div>
                }
            })}

            <div class=move || if is_connected.get() { "chart-feed-state chart-feed-state--live" } else { "chart-feed-state" } role="status">
                <span></span>
                {move || if is_connected.get() { "LIVE" } else { "RECONNECTING" }}
            </div>

            <p class="sr-only">
                {move || {
                    let l = sorted.with(|c| c.last().copied());
                    format!(
                        "Latest close {}. High {}. Low {}. Volume {}.",
                        format_number(l.map(|c| c.close)),
                        format_number(l.map(|c| c.high)),
                        format_number(l.map(|c| c.low)),
                        format_number(l.map(|c| c.volume)),
                    )
                }}
            </p>
        </div>
    }
}
