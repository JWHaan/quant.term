//! Order Flow Imbalance panel — port of `src/features/analytics/OFIIndicator.tsx`.
//! Consumes `use_order_book` snapshots through the typed
//! `quant_core::typed::OfiBookCalculator`.

use std::cell::RefCell;
use std::rc::Rc;

use leptos::prelude::*;
use quant_core::typed::{self, OfiBookCalculator, OfiDepth, OfiEventKind, OfiSignificantEvent};

use super::book_feed::use_order_book;

#[component]
pub fn OfiIndicator(symbol: Memo<String>) -> impl IntoView {
    let book = use_order_book(symbol);

    let current = RwSignal::new(None::<OfiDepth>);
    let ofi_ma = RwSignal::new(0.0f64);
    let significant = RwSignal::new(OfiSignificantEvent {
        kind: None,
        magnitude: 0.0,
    });
    let calculator = Rc::new(RefCell::new(OfiBookCalculator::new()));
    let calculator_reset = Rc::clone(&calculator);

    // TS: reset calculator when the symbol changes.
    Effect::new(move |_| {
        let _sym = symbol.get();
        calculator_reset.borrow_mut().reset();
    });

    // TS effect on [bids, asks]: compute OFI for each new snapshot.
    Effect::new(move |_| {
        let snapshot = book.book.get();
        let Some(snap) = snapshot else { return };
        if snap.bids.is_empty() || snap.asks.is_empty() {
            return;
        }
        let input = typed::BookSnapshotIn {
            bids: snap.bids.clone(),
            asks: snap.asks.clone(),
            timestamp: snap.timestamp,
        };
        let result = typed::ofi_book_calculate(&mut calculator.borrow_mut(), &input);
        if let Ok(Some(res)) = result {
            current.set(Some(res));
            ofi_ma.set(typed::ofi_moving_average(&calculator.borrow(), 10));
            significant.set(typed::ofi_significant_event(&calculator.borrow()));
        }
    });

    let ofi_color = move |ofi: f64| -> &'static str {
        if ofi > 0.1 {
            "var(--accent-success)"
        } else if ofi < -0.1 {
            "var(--accent-danger)"
        } else {
            "var(--text-muted)"
        }
    };

    view! {
        <Show
            when=move || current.get().is_some()
            fallback=|| view! {
                <div class="feed-init">"[INITIALIZING_OFI]..."</div>
            }
        >
            {move || {
                let ofi = current.get().unwrap();
                let ofi_percent = ofi.ofi.abs() * 100.0;
                let color = ofi_color(ofi.ofi);
                let left = if ofi.ofi < 0.0 {
                    (50.0 - ofi_percent).max(0.0)
                } else {
                    50.0
                };
                let width = ofi_percent.min(100.0);
                let sig = significant.get();
                let connected = book.connected.get();
                view! {
                    <div class="signal-panel">
                        <div class="signal-head">
                            <span class="signal-head__label">"DEPTH_FLOW_IMBALANCE · EXPERIMENTAL"</span>
                            <span
                                class="signal-head__state"
                                style=move || format!(
                                    "color:{}",
                                    if connected { "var(--accent-primary)" } else { "var(--accent-danger)" }
                                )
                            >
                                {move || if connected { "[LIVE]" } else { "[OFFLINE]" }}
                            </span>
                        </div>
                        <div class="signal-hero">
                            <span class="signal-hero__value tnum" style=format!("color:{color}")>
                                {format!("{}{}", if ofi.ofi > 0.0 { "+" } else { "" }, fmt3(ofi.ofi))}
                            </span>
                            <span class="signal-hero__pct tnum">
                                {format!("({:.1}%)", ofi_percent)}
                            </span>
                        </div>
                        <div class="signal-meter signal-meter--thin">
                            <div
                                class="signal-meter__fill"
                                style=format!(
                                    "left:{left}%;width:{width}%;background:{color}"
                                )
                            />
                            <div class="signal-meter__center"/>
                        </div>
                        <div class="signal-grid">
                            <div>
                                <span class="signal-kv__key">"BID_PRESSURE:"</span>
                                <span class="signal-kv__val tnum" style="color:var(--accent-success)">
                                    {format!("{:.2}", ofi.bid_pressure)}
                                </span>
                            </div>
                            <div>
                                <span class="signal-kv__key">"ASK_PRESSURE:"</span>
                                <span class="signal-kv__val tnum" style="color:var(--accent-danger)">
                                    {format!("{:.2}", ofi.ask_pressure)}
                                </span>
                            </div>
                            <div>
                                <span class="signal-kv__key">"MA(10):"</span>
                                <span class="signal-kv__val tnum" style="color:var(--text-primary)">
                                    {format!("{:.3}", ofi_ma.get())}
                                </span>
                            </div>
                            <div>
                                <span class="signal-kv__key">"TOTAL_VOL:"</span>
                                <span class="signal-kv__val tnum" style="color:var(--text-primary)">
                                    {format!("{:.2}", ofi.total_volume)}
                                </span>
                            </div>
                        </div>
                        {sig.kind.map(|kind| {
                            let (label, class) = match kind {
                                OfiEventKind::Buy => ("BUY", "signal-alert--buy"),
                                OfiEventKind::Sell => ("SELL", "signal-alert--sell"),
                            };
                            view! {
                                <div class=format!("signal-alert {class}")>
                                    {format!("{label}_IMBALANCE ({:.1}σ)", sig.magnitude)}
                                </div>
                            }
                        })}
                    </div>
                }
            }}
        </Show>
    }
}

fn fmt3(v: f64) -> String {
    format!("{v:.3}")
}
