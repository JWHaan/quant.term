//! Shared panel chrome — ports of `src/ui/{DashboardPanel,TabPanel,LoadingSpinner,MarketOverviewBar}.tsx`.

use crate::stores::{use_stores, now_ms, MarketConditionData};
use leptos::prelude::*;
use std::sync::atomic::{AtomicUsize, Ordering};
use wasm_bindgen::JsCast;

#[component]
pub fn DashboardPanel(
    title: impl Fn() -> String + Copy + Send + Sync + 'static,
    #[prop(optional)] class: Option<String>,
    children: Children,
) -> impl IntoView {
    view! {
        <section class=move || format!("dashboard-panel {}", class.clone().unwrap_or_default()).trim().to_string() aria-label=title()>
            <header class="dashboard-panel__header">
                <span class="dashboard-panel__accent" aria-hidden="true"></span>
                <h2 class="dashboard-panel__title">{move || title()}</h2>
                <span class="dashboard-panel__rule" aria-hidden="true"></span>
            </header>
            <div class="dashboard-panel__content">{children()}</div>
        </section>
    }
}

pub struct TabDef {
    pub id: &'static str,
    pub label: String,
    pub content: AnyView,
}

static TAB_PANEL_UID: AtomicUsize = AtomicUsize::new(0);

fn focus_tab_button(uid: usize, tab_id: &str) {
    #[cfg(target_arch = "wasm32")]
    {
        let id = format!("{uid}-tab-{tab_id}");
        if let Some(el) = web_sys::window()
            .and_then(|w| w.document())
            .and_then(|d| d.get_element_by_id(&id))
        {
            if let Some(h) = el.dyn_ref::<web_sys::HtmlElement>() {
                let _ = h.focus();
            }
        }
    }
    #[cfg(not(target_arch = "wasm32"))]
    let _ = (uid, tab_id);
}

#[component]
pub fn TabPanel(
    tabs: Vec<TabDef>,
    #[prop(optional)] default_tab: Option<&'static str>,
) -> impl IntoView {
    let fallback = tabs
        .iter()
        .find(|t| Some(t.id) == default_tab)
        .or_else(|| tabs.first())
        .map(|t| t.id)
        .unwrap_or("");
    let active = RwSignal::new(fallback);
    let uid = TAB_PANEL_UID.fetch_add(1, Ordering::Relaxed);
    let ids: Vec<&'static str> = tabs.iter().map(|t| t.id).collect();

    let tab_bar = tabs
        .iter()
        .enumerate()
        .map(|(index, tab)| {
            let id = tab.id;
            let label = tab.label.clone();
            let ids = ids.clone();
            view! {
                <button
                    id=format!("{uid}-tab-{id}")
                    type="button"
                    class="tab-panel__tab"
                    role="tab"
                    aria-selected=move || active.get() == id
                    aria-controls=format!("{uid}-panel-{id}")
                    tabindex=move || if active.get() == id { "0" } else { "-1" }
                    on:click=move |_| active.set(id)
                    on:keydown=move |ev: leptos::ev::KeyboardEvent| {
                        let n = ids.len();
                        if n == 0 {
                            return;
                        }
                        let next = match ev.key().as_str() {
                            "ArrowRight" => Some((index + 1) % n),
                            "ArrowLeft" => Some((index + n - 1) % n),
                            "Home" => Some(0),
                            "End" => Some(n - 1),
                            _ => None,
                        };
                        if let Some(ni) = next {
                            ev.prevent_default();
                            let nid = ids[ni];
                            active.set(nid);
                            focus_tab_button(uid, nid);
                        }
                    }
                >
                    <span>{label}</span>
                </button>
            }
        })
        .collect::<Vec<_>>();

    let panes = tabs
        .into_iter()
        .map(|tab| {
            let id = tab.id;
            view! {
                <div
                    id=format!("{uid}-panel-{id}")
                    class="tab-panel__pane"
                    role="tabpanel"
                    aria-labelledby=format!("{uid}-tab-{id}")
                    tabindex="0"
                    hidden=move || active.get() != id
                    aria-hidden=move || active.get() != id
                >
                    {tab.content}
                </div>
            }
        })
        .collect::<Vec<_>>();

    view! {
        <div class="tab-panel">
            <div class="tab-panel__list" role="tablist" aria-label="Panel views" aria-orientation="horizontal">
                {tab_bar}
            </div>
            <div class="tab-panel__content">{panes}</div>
        </div>
    }
}

/// A resizable panel edge: a percentage signal plus the min/max bounds the
/// React `react-resizable-panels` version enforced.
#[derive(Clone, Copy)]
pub struct PanelSize {
    pub value: RwSignal<f64>,
    pub min: f64,
    pub max: f64,
}

#[derive(Clone, Copy)]
struct DragState {
    pos: f64,
    span: f64,
    a0: f64,
    b0: f64,
}

/// Effective [lo, hi] bounds for panel `a` when `a + b` is conserved.
fn pair_bounds(total: f64, a_min: f64, a_max: f64, b_min: f64, b_max: f64) -> (f64, f64) {
    let lo = a_min.max(total - b_max);
    let hi = a_max.min(total - b_min);
    if lo <= hi {
        (lo, hi)
    } else {
        (hi, lo)
    }
}

/// Drag handle between two adjacent panels. `orientation` matches the CSS
/// contract on `.resize-handle`: "vertical" is the column separator (drag
/// horizontally via clientX), "horizontal" is the row separator (clientY).
#[component]
pub fn ResizeHandle(
    a: PanelSize,
    b: PanelSize,
    orientation: &'static str,
) -> impl IntoView {
    let drag = RwSignal::new(Option::<DragState>::None);
    let use_x = orientation == "vertical";

    #[cfg(target_arch = "wasm32")]
    {
        let cb_move = wasm_bindgen::closure::Closure::<dyn FnMut(web_sys::MouseEvent)>::new(
            move |ev: web_sys::MouseEvent| {
                let Some(d) = drag.get() else {
                    return;
                };
                let pos = if use_x {
                    ev.client_x() as f64
                } else {
                    ev.client_y() as f64
                };
                let delta = if d.span > 1.0 {
                    (pos - d.pos) / d.span * 100.0
                } else {
                    0.0
                };
                let total = d.a0 + d.b0;
                let (lo, hi) = pair_bounds(total, a.min, a.max, b.min, b.max);
                let new_a = (d.a0 + delta).clamp(lo, hi);
                a.value.set(new_a);
                b.value.set(total - new_a);
            },
        );
        let cb_up = wasm_bindgen::closure::Closure::<dyn FnMut(web_sys::MouseEvent)>::new(
            move |_ev: web_sys::MouseEvent| {
                drag.set(None);
            },
        );
        if let Some(w) = web_sys::window() {
            let _ = w.add_event_listener_with_callback(
                "mousemove",
                cb_move.as_ref().unchecked_ref(),
            );
            let _ = w.add_event_listener_with_callback(
                "mouseup",
                cb_up.as_ref().unchecked_ref(),
            );
        }
        cb_move.forget();
        cb_up.forget();
    }

    // Suppress text selection while a drag is in flight.
    Effect::new(move |_| {
        let active = drag.get().is_some();
        #[cfg(target_arch = "wasm32")]
        {
            if let Some(body) = web_sys::window()
                .and_then(|w| w.document())
                .and_then(|d| d.body())
            {
                let _ = body
                    .style()
                    .set_property("user-select", if active { "none" } else { "" });
            }
        }
        #[cfg(not(target_arch = "wasm32"))]
        let _ = active;
    });

    let on_down = move |ev: leptos::ev::MouseEvent| {
        ev.prevent_default();
        let (pos, span) = ev
            .target()
            .and_then(|t| t.dyn_into::<web_sys::Element>().ok())
            .and_then(|el| el.parent_element())
            .and_then(|p| p.dyn_into::<web_sys::HtmlElement>().ok())
            .map(|h| {
                if use_x {
                    (ev.client_x() as f64, h.offset_width() as f64)
                } else {
                    (ev.client_y() as f64, h.offset_height() as f64)
                }
            })
            .unwrap_or((0.0, 0.0));
        drag.set(Some(DragState {
            pos,
            span,
            a0: a.value.get(),
            b0: b.value.get(),
        }));
    };

    let on_key = move |ev: leptos::ev::KeyboardEvent| {
        let delta = match ev.key().as_str() {
            "ArrowLeft" if use_x => Some(-1.0),
            "ArrowRight" if use_x => Some(1.0),
            "ArrowUp" if !use_x => Some(-1.0),
            "ArrowDown" if !use_x => Some(1.0),
            "Home" => Some(-1.0e9),
            "End" => Some(1.0e9),
            _ => None,
        };
        if let Some(d) = delta {
            ev.prevent_default();
            let total = a.value.get() + b.value.get();
            let (lo, hi) = pair_bounds(total, a.min, a.max, b.min, b.max);
            let new_a = (a.value.get() + d).clamp(lo, hi);
            a.value.set(new_a);
            b.value.set(total - new_a);
        }
    };

    view! {
        <div
            class=move || if drag.get().is_some() {
                "resize-handle resize-handle--active"
            } else {
                "resize-handle"
            }
            role="separator"
            aria-orientation=orientation
            tabindex="0"
            on:mousedown=on_down
            on:keydown=on_key
        ></div>
    }
}

#[component]
pub fn LoadingSpinner(#[prop(optional)] label: Option<String>) -> impl IntoView {
    let label = label.unwrap_or_else(|| "INITIALIZING".to_string());
    let aria_label = label.clone();
    let frame = RwSignal::new(0usize);
    let frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    Effect::new(move |_| {
        #[cfg(target_arch = "wasm32")]
        {
            let cb = wasm_bindgen::closure::Closure::<dyn FnMut()>::new(move || {
                frame.update(|f| *f = (*f + 1) % frames.len());
            });
            if let Some(w) = web_sys::window() {
                let _ = w.set_interval_with_callback_and_timeout_and_arguments_0(
                    cb.as_ref().unchecked_ref(),
                    80,
                );
            }
            cb.forget();
        }
    });
    view! {
        <div role="status" aria-live="polite" aria-label=format!("{}…", aria_label)
            style="display:flex;align-items:center;justify-content:center;height:100%;width:100%;color:var(--accent-primary);font-size:14px;font-family:var(--font-mono);flex-direction:column;gap:12px;background:var(--bg-panel)">
            <div style="font-size:28px;font-weight:bold;line-height:1">{move || frames[frame.get()]}</div>
            <span class="cursor-blink" style="letter-spacing:2px">{move || format!("{}…", label)}</span>
        </div>
    }
}

#[component]
pub fn MarketOverviewBar(
    symbol: Memo<String>,
    is_connected: Memo<bool>,
) -> impl IntoView {
    let stores = use_stores();
    let now = RwSignal::new(now_ms());
    let normalized = Memo::new(move |_| {
        crate::stores::normalize_binance_spot_symbol(&symbol.get())
    });

    Effect::new(move |_| {
        #[cfg(target_arch = "wasm32")]
        {
            let cb = wasm_bindgen::closure::Closure::<dyn FnMut()>::new(move || {
                now.set(now_ms());
            });
            if let Some(w) = web_sys::window() {
                let _ = w.set_interval_with_callback_and_timeout_and_arguments_0(
                    cb.as_ref().unchecked_ref(),
                    1_000,
                );
            }
            cb.forget();
        }
    });

    // Alert condition checking on each price update (parity with TS useEffect).
    Effect::new(move |_| {
        let sym = normalized.get();
        if let Some(market) = stores.get_market_data(&sym) {
            if market.price.is_finite() {
                stores.check_market_conditions(
                    &sym,
                    market.price,
                    MarketConditionData::default(),
                );
            }
        }
    });

    let market = Memo::new(move |_| {
        stores.get_market_data(&normalized.get())
    });

    let age = move || {
        market
            .get()
            .map(|m| (now.get() - m.timestamp).max(0.0))
    };
    let stale = move || age().map(|a| a > 10_000.0).unwrap_or(true);
    let positive = move || market.get().map(|m| m.price_change_percent >= 0.0).unwrap_or(true);
    let live = move || is_connected.get() && !stale();

    let display_symbol = move || {
        symbol
            .get()
            .replace("USDT", "")
    };

    view! {
        <section class="market-overview" aria-label=format!("{} live market overview", symbol.get())>
            <div class="instrument-identity">
                <span class="instrument-venue">"BINANCE SPOT"</span>
                <strong>{display_symbol}<em>"/USDT"</em></strong>
                <span class=move || format!("feed-chip {}", if live() { "feed-chip--live" } else { "" }).trim().to_string()>
                    <span></span>
                    {move || if live() { "LIVE".to_string() } else if stale() { "STALE".to_string() } else { "CONNECTING".to_string() }}
                </span>
            </div>
            <div class="instrument-price">
                <strong>{move || market.get().map(|m| format_price(m.price)).unwrap_or_else(|| "—".to_string())}</strong>
                <span class=move || if positive() { "positive".to_string() } else { "negative".to_string() }>
                    {move || {
                        let sign = if positive() { "▲" } else { "▼" };
                        let pct = market.get().map(|m| format_percent(m.price_change_percent)).unwrap_or_else(|| "—".to_string());
                        format!("{sign} {pct}")
                    }}
                </span>
            </div>
            <div class="overview-metrics" role="list">
                <div role="listitem"><span>"24H HIGH"</span><strong>{move || market.get().map(|m| format_price(m.high)).unwrap_or_else(|| "—".to_string())}</strong></div>
                <div role="listitem"><span>"24H LOW"</span><strong>{move || market.get().map(|m| format_price(m.low)).unwrap_or_else(|| "—".to_string())}</strong></div>
                <div role="listitem"><span>"24H VOLUME"</span><strong>{move || market.get().map(|m| format!("${}", format_volume(m.quote_volume))).unwrap_or_else(|| "—".to_string())}</strong></div>
                <div role="listitem"><span>"BASE VOLUME"</span><strong>{move || market.get().map(|m| format_volume(m.volume)).unwrap_or_else(|| "—".to_string())}</strong></div>
            </div>
            <div class="overview-source">
                {move || {
                    let a = age();
                    let label = match a {
                        None => "Awaiting first tick".to_string(),
                        Some(v) if v < 1_000.0 => "Updated now".to_string(),
                        Some(v) => format!("Updated {}s ago", (v / 1_000.0).floor() as i64),
                    };
                    view! { <span>{label}</span> }.into_any()
                }}
            </div>
        </section>
    }
}

fn format_price(price: f64) -> String {
    crate::features::backtest::format::format_price(price)
}

fn format_percent(value: f64) -> String {
    format!("{value:.2}%")
}

fn format_volume(value: f64) -> String {
    let abs = value.abs();
    if abs >= 1e9 {
        format!("{:.2}B", value / 1e9)
    } else if abs >= 1e6 {
        format!("{:.2}M", value / 1e6)
    } else if abs >= 1e3 {
        format!("{:.2}K", value / 1e3)
    } else {
        format!("{value:.2}")
    }
}
