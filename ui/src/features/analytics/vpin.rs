//! VPIN toxicity panel — port of `src/features/analytics/VPINIndicator.tsx`.
//! Consumes the shared `@aggTrade` feed; classifies trades with the exchange
//! taker side (quantity pre-multiplied by price for quote-volume buckets)
//! through `quant_core::typed`.

use std::cell::RefCell;
use std::rc::Rc;

use leptos::prelude::*;
use quant_core::typed::{self, AggTrade, TradeClassifierCore, VpinCalculatorCore, VpinResult, VpinToxicity, VpinTrend};

use super::trade_feed::{subscribe_agg_trades, AggTradeSubscription};

const VPIN_BUCKET_SIZE: f64 = 500_000.0;
const VPIN_NUM_BUCKETS: u32 = 20;
const VPIN_TREND_LOOKBACK: u32 = 10;

fn toxicity_color(toxicity: VpinToxicity) -> &'static str {
    match toxicity {
        VpinToxicity::Low => "var(--accent-success)",
        VpinToxicity::Medium => "#FFD700",
        VpinToxicity::High => "#FFA500",
        VpinToxicity::Extreme => "var(--accent-danger)",
    }
}

fn toxicity_label(toxicity: VpinToxicity) -> &'static str {
    match toxicity {
        VpinToxicity::Low => "low",
        VpinToxicity::Medium => "medium",
        VpinToxicity::High => "high",
        VpinToxicity::Extreme => "extreme",
    }
}

fn trend_icon(trend: VpinTrend) -> &'static str {
    match trend {
        VpinTrend::Increasing => "▲",
        VpinTrend::Decreasing => "▼",
        VpinTrend::Stable => "—",
    }
}

#[component]
pub fn VpinIndicator(symbol: Memo<String>) -> impl IntoView {
    let result = RwSignal::new(None::<VpinResult>);
    let trend = RwSignal::new(VpinTrend::Stable);
    let bucket_progress = RwSignal::new(0.0f64);
    let connected = RwSignal::new(false);
    let classifier = Rc::new(RefCell::new(TradeClassifierCore::new()));
    let vpin = Rc::new(RefCell::new(VpinCalculatorCore::new(
        VPIN_BUCKET_SIZE,
        VPIN_NUM_BUCKETS,
    )));
    let subscription = Rc::new(RefCell::new(None::<AggTradeSubscription>));

    Effect::new(move |_| {
        let sym = symbol.get();
        let classifier = Rc::clone(&classifier);
        let vpin = Rc::clone(&vpin);
        let sub = subscribe_agg_trades(
            &sym,
            move |trade: AggTrade| {
                // VPIN buckets on quote volume: quantity * price.
                let quote_trade = AggTrade {
                    quantity: trade.quantity * trade.price,
                    ..trade
                };
                if let Ok(classified) =
                    typed::classify_from_exchange(&mut classifier.borrow_mut(), &quote_trade)
                {
                    if let Ok(Some(r)) = typed::vpin_add_trade(&mut vpin.borrow_mut(), &classified)
                    {
                        result.set(Some(r));
                        trend.set(typed::vpin_trend(&vpin.borrow(), VPIN_TREND_LOOKBACK));
                    }
                }
                if trade.id % 20.0 == 0.0 {
                    bucket_progress.set(typed::vpin_bucket_progress(&vpin.borrow()));
                }
            },
            move |c| connected.set(c),
        );
        *subscription.borrow_mut() = Some(sub);
    });

    view! {
        <Show
            when=move || result.get().is_some()
            fallback=move || {
                view! {
                    <div class="feed-init">
                        {format!(
                            "[{}]... ({:.0}% BUCKET)",
                            if connected.get() { "INITIALIZING_VPIN" } else { "CONNECTING_TRADE_FEED" },
                            bucket_progress.get()
                        )}
                    </div>
                }
            }
        >
            {move || {
                let r = result.get().unwrap();
                let color = toxicity_color(r.toxicity);
                let label = toxicity_label(r.toxicity);
                let vpin_percent = r.vpin * 100.0;
                let tr = trend.get();
                let extreme = r.toxicity == VpinToxicity::Extreme;
                view! {
                    <div class=if extreme { "signal-panel signal-panel--danger" } else { "signal-panel" }>
                        <div class="signal-head">
                            <span class="signal-head__label">"> VPIN_TOXICITY"</span>
                            <div class="signal-head__meta">
                                <span>{trend_icon(tr)}</span>
                                <span>{format!("[{}]", trend_label(tr))}</span>
                            </div>
                        </div>
                        <div class="signal-hero">
                            <span class="signal-hero__value tnum" style=format!("color:{color}")>
                                {format!("{:.3}", r.vpin)}
                            </span>
                            <span class="signal-hero__tag" style=format!("color:{color}")>
                                {format!("[{label}]")}
                            </span>
                        </div>
                        <div class="signal-meter signal-meter--thick">
                            <div
                                class="signal-meter__fill"
                                style=format!(
                                    "left:0;width:{}%;background:{}",
                                    vpin_percent.min(100.0),
                                    color
                                )
                            />
                        </div>
                        <div class="signal-bucket">
                            <div class="signal-bucket__row">
                                <span class="signal-bucket__key">"CURRENT_BUCKET:"</span>
                                <span class="tnum">{format!("{:.1}%", bucket_progress.get())}</span>
                            </div>
                            <div class="signal-meter signal-meter--hairline">
                                <div
                                    class="signal-meter__fill"
                                    style=format!(
                                        "left:0;width:{}%;background:var(--accent-primary)",
                                        bucket_progress.get()
                                    )
                                />
                            </div>
                        </div>
                        <div class="signal-grid">
                            <div>
                                <span class="signal-kv__key">"BUCKETS:"</span>
                                <span class="signal-kv__val tnum" style="color:var(--text-primary)">
                                    {r.buckets_filled}
                                </span>
                            </div>
                            <div>
                                <span class="signal-kv__key">"BUCKET_VOL:"</span>
                                <span class="signal-kv__val tnum" style="color:var(--text-primary)">
                                    {format!("{:.1}", r.current_bucket.total_volume)}
                                </span>
                            </div>
                        </div>
                        {extreme.then(|| {
                            view! {
                                <div class="signal-alert signal-alert--sell signal-alert--pulse">
                                    <span>">> HIGH_TOXICITY_DETECTED"</span>
                                </div>
                            }
                        })}
                        <div class="signal-note">
                            "$500K QUOTE BUCKETS · 20-BUCKET ROLLING ESTIMATE · EXPERIMENTAL"
                        </div>
                    </div>
                }
            }}
        </Show>
    }
}

fn trend_label(trend: VpinTrend) -> &'static str {
    match trend {
        VpinTrend::Increasing => "INCREASING",
        VpinTrend::Decreasing => "DECREASING",
        VpinTrend::Stable => "STABLE",
    }
}
