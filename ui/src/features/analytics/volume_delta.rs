//! Volume Delta / CVD panel — port of
//! `src/features/analytics/VolumeDeltaIndicator.tsx`. Consumes the shared
//! `@aggTrade` feed; classifies taker side via `quant_core::typed` and
//! recomputes the 60s rolling delta every 10th trade id (same cadence as TS).

use std::cell::RefCell;
use std::rc::Rc;

use leptos::prelude::*;
use quant_core::typed::{self, AggTrade, Divergence, DivergenceKind, PricePoint, TradeClassifierCore, VolumeDelta};

use super::trade_feed::{subscribe_agg_trades, AggTradeSubscription};

const VOLUME_DELTA_WINDOW_MS: f64 = 60_000.0;
const PRICE_HISTORY_CAP: usize = 100;

fn delta_color(delta: f64) -> &'static str {
    if delta > 0.0 {
        "var(--accent-success)"
    } else if delta < 0.0 {
        "var(--accent-danger)"
    } else {
        "var(--text-muted)"
    }
}

#[component]
pub fn VolumeDeltaIndicator(symbol: Memo<String>) -> impl IntoView {
    let volume_delta = RwSignal::new(None::<VolumeDelta>);
    let buy_sell_ratio = RwSignal::new(1.0f64);
    let divergence = RwSignal::new(Divergence {
        kind: None,
        strength: 0.0,
    });
    let connected = RwSignal::new(false);
    let classifier = Rc::new(RefCell::new(TradeClassifierCore::new()));
    let price_history = Rc::new(RefCell::new(Vec::<PricePoint>::new()));
    let subscription = Rc::new(RefCell::new(None::<AggTradeSubscription>));

    Effect::new(move |_| {
        let sym = symbol.get();
        let classifier = Rc::clone(&classifier);
        let price_history = Rc::clone(&price_history);
        let sub = subscribe_agg_trades(
            &sym,
            move |trade: AggTrade| {
                // Exchange taker-side classification on the raw trade.
                let _ = typed::classify_from_exchange(&mut classifier.borrow_mut(), &trade);
                {
                    let mut history = price_history.borrow_mut();
                    history.push(PricePoint {
                        timestamp: trade.timestamp,
                        price: trade.price,
                    });
                    if history.len() > PRICE_HISTORY_CAP {
                        history.remove(0);
                    }
                }
                if trade.id % 10.0 == 0.0 {
                    volume_delta.set(Some(typed::volume_delta(
                        &classifier.borrow(),
                        VOLUME_DELTA_WINDOW_MS,
                    )));
                    buy_sell_ratio.set(typed::buy_sell_ratio(
                        &classifier.borrow(),
                        VOLUME_DELTA_WINDOW_MS,
                    ));
                    let history = price_history.borrow().clone();
                    divergence.set(typed::detect_divergence(&classifier.borrow(), &history));
                }
            },
            move |c| connected.set(c),
        );
        *subscription.borrow_mut() = Some(sub);
    });

    view! {
        <Show
            when=move || volume_delta.get().is_some()
            fallback=move || {
                view! {
                    <div class="feed-init">
                        {format!(
                            "[{}]...",
                            if connected.get() { "INITIALIZING_CVD" } else { "CONNECTING_TRADE_FEED" }
                        )}
                    </div>
                }
            }
        >
            {move || {
                let vd = volume_delta.get().unwrap();
                let color = delta_color(vd.delta);
                let is_positive = vd.delta > 0.0;
                let ratio = buy_sell_ratio.get();
                let div = divergence.get();
                let show_divergence = div.kind.is_some() && div.strength > 0.05;
                view! {
                    <div class="signal-panel">
                        <div class="signal-head">
                            <span class="signal-head__label">"> VOLUME_DELTA_CVD"</span>
                            <div class="signal-head__meta">
                                <span>{if is_positive { "▲" } else { "▼" }}</span>
                            </div>
                        </div>
                        <div class="signal-hero">
                            <span class="signal-hero__value tnum" style=format!("color:{color}")>
                                {format!("{}{}", if is_positive { "+" } else { "" }, fmt2(vd.delta))}
                            </span>
                            <span class="signal-hero__pct tnum">
                                {format!("({:.1}%)", vd.delta_percent)}
                            </span>
                        </div>
                        <div class="signal-duo">
                            <div class="signal-duo__card signal-duo__card--buy">
                                <div class="signal-duo__label">"BUY_VOL"</div>
                                <div class="signal-duo__value tnum signal-duo__value--buy">
                                    {format!("{:.2}", vd.buy_volume)}
                                </div>
                            </div>
                            <div class="signal-duo__card signal-duo__card--sell">
                                <div class="signal-duo__label">"SELL_VOL"</div>
                                <div class="signal-duo__value tnum signal-duo__value--sell">
                                    {format!("{:.2}", vd.sell_volume)}
                                </div>
                            </div>
                        </div>
                        <div class="signal-strip">
                            <span class="signal-kv__key">"BUY/SELL_RATIO:"</span>
                            <span
                                class="tnum"
                                style=format!(
                                    "color:{};font-weight:bold",
                                    if ratio > 1.0 { "var(--accent-success)" } else { "var(--accent-danger)" }
                                )
                            >
                                {format!("{:.2}x", ratio)}
                            </span>
                        </div>
                        {if show_divergence {
                            div.kind.map(|kind| {
                                let (label, class) = match kind {
                                    DivergenceKind::Bullish => ("BULLISH", "signal-alert--buy"),
                                    DivergenceKind::Bearish => ("BEARISH", "signal-alert--sell"),
                                };
                                view! {
                                    <div class=format!("signal-alert {class}")>
                                        <span>{format!(">> {label}_DIVERGENCE ({:.1}%)", div.strength * 100.0)}</span>
                                    </div>
                                }
                            })
                        } else {
                            None
                        }}
                        <div class="signal-note">
                            "1-MIN WINDOW · BINANCE TAKER-SIDE CLASSIFICATION"
                        </div>
                    </div>
                }
            }}
        </Show>
    }
}

fn fmt2(v: f64) -> String {
    format!("{v:.2}")
}
