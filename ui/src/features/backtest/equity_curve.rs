//! Equity curve chart — port of `src/features/backtest/EquityCurveChart.tsx`.
//! Renders the same SVG (viewBox 900x260, padded axes, gradient area) that the
//! React version produced; path geometry is computed with identical math.

use leptos::prelude::*;
use quant_core::typed::{self, BacktestEquityPoint};

use super::format::format_currency;

const WIDTH: f64 = 900.0;
const HEIGHT: f64 = 260.0;
const PAD_TOP: f64 = 22.0;
const PAD_RIGHT: f64 = 18.0;
const PAD_BOTTOM: f64 = 34.0;
const PAD_LEFT: f64 = 72.0;

struct ChartGeom {
    line: String,
    area: String,
    ticks: Vec<(f64, f64)>, // (value, y)
    raw_min: f64,
    raw_max: f64,
}

fn compute_chart(points: &[BacktestEquityPoint]) -> Option<ChartGeom> {
    if points.is_empty() {
        return None;
    }
    let mut raw_min = f64::INFINITY;
    let mut raw_max = f64::NEG_INFINITY;
    for p in points {
        raw_min = raw_min.min(p.equity);
        raw_max = raw_max.max(p.equity);
    }
    let padding = ((raw_max - raw_min) * 0.12).max(raw_max * 0.002);
    let min = raw_min - padding;
    let max = raw_max + padding;
    let inner_width = WIDTH - PAD_LEFT - PAD_RIGHT;
    let inner_height = HEIGHT - PAD_TOP - PAD_BOTTOM;

    let x = |index: usize| -> f64 {
        PAD_LEFT
            + (index as f64 / (points.len().saturating_sub(1)).max(1) as f64) * inner_width
    };
    let y = |value: f64| -> f64 {
        PAD_TOP
            + ((max - value) / (max - min).max(f64::EPSILON)) * inner_height
    };

    let mut line = String::new();
    for (index, point) in points.iter().enumerate() {
        if index == 0 {
            line.push('M');
        } else {
            line.push('L');
        }
        line.push_str(&format!("{:.2},{:.2} ", x(index), y(point.equity)));
    }
    let line = line.trim_end().to_string();
    let last_x = x(points.len() - 1);
    let area = format!(
        "{} L{:.2},{:.2} L{:.2},{:.2} Z",
        line,
        last_x,
        HEIGHT - PAD_BOTTOM,
        PAD_LEFT,
        HEIGHT - PAD_BOTTOM
    );
    let mut ticks = Vec::with_capacity(5);
    for index in 0..5 {
        let ratio = index as f64 / 4.0;
        let value = max - (max - min) * ratio;
        ticks.push((value, PAD_TOP + inner_height * ratio));
    }
    Some(ChartGeom {
        line,
        area,
        ticks,
        raw_min,
        raw_max,
    })
}

/// `points` is owned: the parent recreates this component whenever a new
/// backtest result arrives, matching the React re-render.
#[component]
pub fn EquityCurveChart(points: Vec<BacktestEquityPoint>) -> impl IntoView {
    let chart = compute_chart(&points);
    let empty = chart.is_none();
    let geom = chart.unwrap_or(ChartGeom {
        line: String::new(),
        area: String::new(),
        ticks: Vec::new(),
        raw_min: 0.0,
        raw_max: 0.0,
    });
    let first = points.first().copied();
    let last = points.last().copied();
    let direction_positive = last.zip(first).map(|(l, f)| l.equity >= f.equity);
    let line_color = if direction_positive == Some(true) {
        "var(--accent-success)"
    } else {
        "var(--accent-danger)"
    };
    let direction_class = if direction_positive == Some(true) {
        "positive"
    } else {
        "negative"
    };
    let caption = match (first, last) {
        (Some(f), Some(l)) => format!(
            "{} → {}",
            format_currency(f.equity, 2),
            format_currency(l.equity, 2)
        ),
        _ => String::new(),
    };
    let first_hm = first.map(|p| typed::format_utc_hm(p.time)).unwrap_or_default();
    let last_hm = last.map(|p| typed::format_utc_hm(p.time)).unwrap_or_default();
    let point_count = points.len();

    view! {
        <Show when=move || !empty>
            <figure class="backtest-chart">
                <figcaption>
                    <span>"MARK-TO-MARKET EQUITY"</span>
                    <strong class=direction_class>{caption.clone()}</strong>
                </figcaption>
                <svg
                    viewBox=format!("0 0 {} {}", WIDTH as u32, HEIGHT as u32)
                    role="img"
                    aria-labelledby="equity-chart-title equity-chart-description"
                    preserveAspectRatio="none"
                >
                    <title id="equity-chart-title">"Backtest equity curve"</title>
                    <desc id="equity-chart-description">
                        {format!(
                            "Equity ranges from {} to {} across {} one-minute candles.",
                            format_currency(geom.raw_min, 2),
                            format_currency(geom.raw_max, 2),
                            point_count
                        )}
                    </desc>
                    <defs>
                        <linearGradient id="equity-area-gradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color=line_color stop-opacity="0.24"/>
                            <stop offset="100%" stop-color=line_color stop-opacity="0.01"/>
                        </linearGradient>
                    </defs>
                    {geom.ticks.iter().map(|(value, y)| {
                        let y = *y;
                        let label = format_currency(*value, 2);
                        view! {
                            <g>
                                <line
                                    x1=PAD_LEFT.to_string()
                                    x2=(WIDTH - PAD_RIGHT).to_string()
                                    y1=y.to_string()
                                    y2=y.to_string()
                                    stroke="var(--chart-grid)"
                                    stroke-width="1"
                                />
                                <text
                                    x=(PAD_LEFT - 10.0).to_string()
                                    y=(y + 3.0).to_string()
                                    text-anchor="end"
                                    fill="var(--text-muted)"
                                    font-size="10"
                                >{label}</text>
                            </g>
                        }
                    }).collect::<Vec<_>>()}
                    <path d=geom.area.clone() fill="url(#equity-area-gradient)"/>
                    <path
                        d=geom.line.clone()
                        fill="none"
                        stroke=line_color
                        stroke-width="2"
                        vector-effect="non-scaling-stroke"
                    />
                    <text
                        x=PAD_LEFT.to_string()
                        y=(HEIGHT - 10.0).to_string()
                        fill="var(--text-muted)"
                        font-size="10"
                    >{first_hm.clone()}</text>
                    <text
                        x=(WIDTH - PAD_RIGHT).to_string()
                        y=(HEIGHT - 10.0).to_string()
                        text-anchor="end"
                        fill="var(--text-muted)"
                        font-size="10"
                    >{last_hm.clone()}</text>
                </svg>
            </figure>
        </Show>
    }
}
