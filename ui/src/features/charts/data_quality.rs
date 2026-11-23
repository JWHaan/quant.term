//! Port of `src/ui/DataQualityBadge.tsx` — latency status badge with a
//! hover tooltip showing the latency distribution and a mini histogram.

use leptos::prelude::*;
use wasm_bindgen::JsCast;

use crate::services::provenance::{with_provenance_engine, FeedStatus, LatencyDistribution};

fn empty_distribution() -> LatencyDistribution {
    LatencyDistribution {
        p50: 0.0,
        p95: 0.0,
        p99: 0.0,
        samples: Vec::new(),
        last_updated: 0.0,
    }
}

fn latency_color(status: FeedStatus, latency: f64) -> &'static str {
    match status {
        FeedStatus::Disconnected => "var(--text-muted)",
        FeedStatus::Connecting => "var(--accent-warning)",
        FeedStatus::Stale => "var(--accent-danger)",
        _ if latency < 100.0 => "var(--accent-success)",
        _ if latency < 500.0 => "var(--accent-warning)",
        _ => "var(--accent-danger)",
    }
}

fn quality_label(status: FeedStatus, latency: f64) -> &'static str {
    match status {
        FeedStatus::Disconnected => "OFFLINE",
        FeedStatus::Connecting => "CONNECTING",
        FeedStatus::Stale => "STALE",
        FeedStatus::Replay => "REPLAY",
        _ if latency < 100.0 => "EXCELLENT",
        _ if latency < 200.0 => "GOOD",
        _ if latency < 500.0 => "FAIR",
        _ => "POOR",
    }
}

fn status_icon(status: FeedStatus) -> AnyView {
    // Lucide icons at size 10, stroke=currentColor.
    let inner = match status {
        FeedStatus::Stale | FeedStatus::Connecting => view! {
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        }
        .into_any(),
        FeedStatus::Disconnected => view! {
            <line x1="2" x2="22" y1="2" y2="22"/>
            <path d="M8.5 16.5a5 5 0 0 1 7 0"/>
            <path d="M2 8.82a15.02 15.02 0 0 1 4.17-2.65"/>
            <path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76"/>
            <path d="M16.85 11.25a10 10 0 0 1 2.22 1.68"/>
            <path d="M5 13a10 10 0 0 1 5.24-2.76"/>
            <line x1="12" x2="12.01" y1="20" y2="20"/>
        }
        .into_any(),
        FeedStatus::Replay => view! {
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" style="opacity: 0.6"/>
        }
        .into_any(),
        FeedStatus::Live => view! {
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        }
        .into_any(),
    };
    view! {
        <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
        >
            {inner}
        </svg>
    }
    .into_any()
}

fn warning_icon() -> AnyView {
    view! {
        <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            style="color: var(--accent-warning)"
        >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>
            <path d="M12 9v4"/><path d="M12 17h.01"/>
        </svg>
    }
    .into_any()
}

/// `LatencyHistogram` — 10 buckets over the sample range, divs not canvas.
#[component]
fn LatencyHistogram(samples: Vec<f64>) -> impl IntoView {
    let finite: Vec<f64> = samples.iter().copied().filter(|v| v.is_finite()).collect();
    if finite.is_empty() {
        return ().into_any();
    }
    let min = finite.iter().fold(f64::INFINITY, |a, &b| a.min(b));
    let max = finite.iter().fold(f64::NEG_INFINITY, |a, &b| a.max(b));
    const BUCKETS: usize = 10;
    let bucket_size = (max - min) / BUCKETS as f64;
    let mut counts = vec![0usize; BUCKETS];
    if bucket_size.is_finite() && bucket_size > 0.0 {
        for &s in &finite {
            let idx = ((s - min) / bucket_size).floor() as usize;
            counts[idx.min(BUCKETS - 1)] += 1;
        }
    }
    let max_count = counts.iter().copied().max().unwrap_or(0);

    view! {
        <div style="display: flex; align-items: flex-end; gap: 1px; height: 30px; padding: 2px">
            {(0..BUCKETS)
                .map(|index| {
                    let count = counts[index];
                    let height = if max_count > 0 {
                        (count as f64 / max_count as f64) * 100.0
                    } else {
                        0.0
                    };
                    let bucket_min = min + index as f64 * bucket_size;
                    let bucket_max = min + (index + 1) as f64 * bucket_size;
                    let bar_color = if bucket_max > 500.0 {
                        "var(--accent-danger)"
                    } else if bucket_max > 100.0 {
                        "var(--accent-warning)"
                    } else {
                        "var(--accent-success)"
                    };
                    let min_height = if count > 0 { "2px" } else { "0px" };
                    let title = format!("{bucket_min:.0}-{bucket_max:.0}ms: {count} samples");
                    view! {
                        <div
                            style=format!(
                                "flex: 1; height: {height}%; background-color: {bar_color}; opacity: 0.7; min-height: {min_height}; transition: height 0.3s ease"
                            )
                            title=title
                        ></div>
                    }
                })
                .collect_view()}
        </div>
    }
    .into_any()
}

#[component]
pub fn DataQualityBadge(
    symbol: Memo<String>,
    #[prop(optional)] has_gap: bool,
    #[prop(optional)] class: Option<String>,
) -> impl IntoView {
    // (p50 latency, feed status, full distribution) — refreshed every second,
    // mirroring the TS provenance polling effect in ChartContainer.
    let snap = RwSignal::new((0.0f64, FeedStatus::Connecting, empty_distribution()));
    let refresh = move || {
        let sym = symbol.get().to_uppercase();
        let next = with_provenance_engine(&sym, |engine| {
            let dist = engine.get_latency_distribution();
            let status = engine.get_feed_status();
            (dist.p50, status, dist)
        });
        snap.set(next);
    };
    refresh();
    Effect::new(move |_| {
        #[cfg(target_arch = "wasm32")]
        {
            let cb = wasm_bindgen::closure::Closure::<dyn FnMut()>::new(move || refresh());
            if let Some(w) = web_sys::window() {
                let _ = w.set_interval_with_callback_and_timeout_and_arguments_0(
                    cb.as_ref().unchecked_ref(),
                    1_000,
                );
            }
            cb.forget();
        }
    });

    let show_tooltip = RwSignal::new(false);
    let tip_pos = RwSignal::new((0.0f64, 0.0f64));

    let color = move || {
        let (latency, status, _) = snap.get();
        latency_color(status, latency)
    };
    let label = move || {
        let (latency, status, _) = snap.get();
        quality_label(status, latency)
    };

    let badge_class = move || {
        format!("data-quality-badge {}", class.clone().unwrap_or_default())
            .trim()
            .to_string()
    };

    let badge_style = move || {
        format!(
            "display: inline-flex; align-items: center; gap: 4px; padding: 3px 6px; \
             background-color: color-mix(in srgb, currentColor 12%, transparent); \
             border: 1px solid currentColor; border-radius: var(--radius-sm); \
             font-size: 9px; font-family: var(--font-mono); color: {}; \
             cursor: help; transition: all 0.2s ease",
            color()
        )
    };

    let tooltip = move || {
        if !show_tooltip.get() {
            return ().into_any();
        }
        let (x, y) = tip_pos.get();
        let (latency, status, dist) = snap.get();
        let color = latency_color(status, latency);
        view! {
            <div
                style=format!(
                    "position: fixed; left: {}px; top: {}px; z-index: 10000; \
                     background-color: var(--bg-panel-raised); \
                     border: 1px solid var(--border-strong); \
                     border-radius: var(--radius-md); padding: 8px; \
                     min-width: 200px; box-shadow: var(--shadow-elevated); \
                     pointer-events: none",
                    x + 10.0,
                    y + 10.0
                )
            >
                <div style="font-size: 10px; font-family: var(--font-mono); color: var(--accent-primary); margin-bottom: 6px; font-weight: 600">
                    {format!("{} Data Quality", symbol.get())}
                </div>
                <div style="font-size: 9px; color: var(--text-secondary); margin-bottom: 6px">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 2px">
                        <span>"Current:"</span>
                        <span style=format!("color: {color}; font-weight: 600")>{format!("{latency}ms")}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 2px">
                        <span>"P50 (Median):"</span>
                        <span style="color: var(--accent-success)">{format!("{:.1}ms", dist.p50)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 2px">
                        <span>"P95:"</span>
                        <span style="color: var(--accent-warning)">{format!("{:.1}ms", dist.p95)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 2px">
                        <span>"P99:"</span>
                        <span style="color: var(--accent-danger)">{format!("{:.1}ms", dist.p99)}</span>
                    </div>
                </div>
                <div style="margin-top: 6px">
                    <div style="font-size: 8px; color: var(--text-muted); margin-bottom: 3px">
                        "Latency Distribution"
                    </div>
                    <LatencyHistogram samples=dist.samples />
                </div>
                <div style="font-size: 8px; color: var(--text-muted); margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--border-subtle)">
                    "Status: "
                    <span style=format!("color: {color}")>{status.as_str()}</span>
                    {if has_gap {
                        view! {
                            <span style="color: var(--accent-warning); margin-left: 8px">"⚠ Gap Detected"</span>
                        }
                        .into_any()
                    } else {
                        ().into_any()
                    }}
                </div>
            </div>
        }
        .into_any()
    };

    view! {
        <div
            class=badge_class
            style=badge_style
            on:mouseenter=move |ev: leptos::ev::MouseEvent| {
                show_tooltip.set(true);
                tip_pos.set((ev.client_x() as f64, ev.client_y() as f64));
            }
            on:mousemove=move |ev: leptos::ev::MouseEvent| {
                if show_tooltip.get_untracked() {
                    tip_pos.set((ev.client_x() as f64, ev.client_y() as f64));
                }
            }
            on:mouseleave=move |_| show_tooltip.set(false)
        >
            {move || status_icon(snap.get().1)}
            <span style="font-weight: 600">{move || {
                let (latency, _, _) = snap.get();
                format!("{latency}ms")
            }}</span>
            <span style="opacity: 0.8">{label}</span>
            {if has_gap { warning_icon() } else { ().into_any() }}
        </div>
        {tooltip}
    }
}
