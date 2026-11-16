//! Quant Signal Engine — port of `src/features/analytics/QuantSignalEngine.tsx`.
//! Polls Binance `15m` klines (limit 200) every 30s, scores RSI / Bollinger
//! position / MACD / ATR through `quant_core::typed`, and feeds the alert
//! store's `check_market_conditions` exactly like the TS version.

use std::cell::RefCell;
use std::rc::Rc;

use leptos::prelude::*;
use quant_core::typed;
use wasm_bindgen_futures::spawn_local;

use crate::features::backtest::klines::{self, KlinesError};
use crate::services::rest::sleep_ms;
use crate::stores::{now_ms, use_stores, MarketConditionData};

const ANALYSIS_INTERVAL: &str = "15m";
const ANALYSIS_LIMIT: usize = 200;
const ANALYSIS_POLL_INTERVAL_MS: f64 = 30_000.0;
const REQUEST_TIMEOUT_LABEL: &str = "Signal request timed out";
const BUY_SIGNAL_THRESHOLD: f64 = 10.0;
const STRONG_BUY_SIGNAL_THRESHOLD: f64 = 40.0;
const SELL_SIGNAL_THRESHOLD: f64 = -10.0;
const STRONG_SELL_SIGNAL_THRESHOLD: f64 = -40.0;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum MacdSignal {
    Bullish,
    Bearish,
    Neutral,
}

impl MacdSignal {
    fn as_str(&self) -> &'static str {
        match self {
            MacdSignal::Bullish => "BULLISH",
            MacdSignal::Bearish => "BEARISH",
            MacdSignal::Neutral => "NEUTRAL",
        }
    }
}

#[derive(Clone, Copy)]
struct QuantSignal {
    rsi: f64,
    bb_position: f64,
    macd_signal: MacdSignal,
    atr_percent: f64,
    score: f64,
    price: f64,
}

/// `getSignalLabel` — spaced labels used in the alert payload.
fn signal_label(score: f64) -> &'static str {
    if score > STRONG_BUY_SIGNAL_THRESHOLD {
        "STRONG BUY"
    } else if score > BUY_SIGNAL_THRESHOLD {
        "BUY"
    } else if score < STRONG_SELL_SIGNAL_THRESHOLD {
        "STRONG SELL"
    } else if score < SELL_SIGNAL_THRESHOLD {
        "SELL"
    } else {
        "NEUTRAL"
    }
}

/// `getMasterSignal` — underscored labels for display.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum MasterSignal {
    Neutral,
    Buy,
    Sell,
    StrongBuy,
    StrongSell,
}

impl MasterSignal {
    fn as_str(&self) -> &'static str {
        match self {
            MasterSignal::Neutral => "NEUTRAL",
            MasterSignal::Buy => "BUY",
            MasterSignal::Sell => "SELL",
            MasterSignal::StrongBuy => "STRONG_BUY",
            MasterSignal::StrongSell => "STRONG_SELL",
        }
    }
    fn color(&self) -> &'static str {
        match self {
            MasterSignal::StrongBuy | MasterSignal::Buy => "var(--accent-success)",
            MasterSignal::StrongSell | MasterSignal::Sell => "var(--accent-danger)",
            MasterSignal::Neutral => "var(--text-secondary)",
        }
    }
    fn is_bullish(&self) -> bool {
        matches!(self, MasterSignal::StrongBuy | MasterSignal::Buy)
    }
    fn is_bearish(&self) -> bool {
        matches!(self, MasterSignal::StrongSell | MasterSignal::Sell)
    }
}

fn master_signal(score: f64) -> MasterSignal {
    if score > STRONG_BUY_SIGNAL_THRESHOLD {
        MasterSignal::StrongBuy
    } else if score > BUY_SIGNAL_THRESHOLD {
        MasterSignal::Buy
    } else if score < STRONG_SELL_SIGNAL_THRESHOLD {
        MasterSignal::StrongSell
    } else if score < SELL_SIGNAL_THRESHOLD {
        MasterSignal::Sell
    } else {
        MasterSignal::Neutral
    }
}

async fn analyze_market(symbol: &str) -> Result<QuantSignal, String> {
    let candles = klines::fetch_klines_latest(symbol, ANALYSIS_INTERVAL, ANALYSIS_LIMIT)
        .await
        .map_err(|e| match e {
            KlinesError::Timeout => REQUEST_TIMEOUT_LABEL.to_string(),
            KlinesError::NoClosedCandles => "Unexpected kline response".to_string(),
            other => other.to_string(),
        })?;
    if candles.is_empty() {
        return Err("Unexpected kline response".to_string());
    }
    if candles.len() < 50 {
        return Err("Insufficient kline history".to_string());
    }

    let last_close = candles.last().map(|c| c.close).unwrap_or(0.0);
    let rsi_series = typed::rsi(&candles, 14)?;
    let rsi = if rsi_series.is_empty() {
        50.0
    } else {
        rsi_series.last().map(|v| v.value).unwrap_or(50.0)
    };

    let bb_series = typed::bollinger_bands(&candles, 20, 2.0)?;
    // TS: `(lastClose - bb.lower) / (bb.upper - bb.lower)` with no zero guard;
    // `0.5` only when the series is empty.
    let bb_position = bb_series
        .last()
        .map(|bb| (last_close - bb.lower) / (bb.upper - bb.lower))
        .unwrap_or(0.5);

    let macd_series = typed::macd(&candles, 12, 26, 9)?;
    let macd_signal = match macd_series.last() {
        Some(m) if m.histogram > 0.0 => MacdSignal::Bullish,
        Some(_) => MacdSignal::Bearish,
        None => MacdSignal::Neutral,
    };

    let atr_series = typed::atr(&candles, 14)?;
    let atr = atr_series.last().map(|v| v.value).unwrap_or(0.0);
    let atr_percent = if last_close != 0.0 {
        (atr / last_close) * 100.0
    } else {
        0.0
    };

    let mut score = 0.0;
    if rsi < 30.0 {
        score += 30.0;
    } else if rsi > 70.0 {
        score -= 30.0;
    }
    if bb_position < 0.1 {
        score += 20.0;
    } else if bb_position > 0.9 {
        score -= 20.0;
    }
    match macd_signal {
        MacdSignal::Bullish => score += 20.0,
        MacdSignal::Bearish => score -= 20.0,
        MacdSignal::Neutral => {}
    }

    Ok(QuantSignal {
        rsi,
        bb_position,
        macd_signal,
        atr_percent,
        score,
        price: last_close,
    })
}

/// Meaningful-change dedupe — port of the `setSignals(prev => ...)` updater.
fn is_meaningful_change(prev: &QuantSignal, next: &QuantSignal) -> bool {
    (prev.rsi - next.rsi).abs() > 0.5
        || (prev.bb_position - next.bb_position).abs() > 0.02
        || (prev.atr_percent - next.atr_percent).abs() > 0.1
        || (prev.score - next.score).abs() >= 1.0
        || prev.macd_signal != next.macd_signal
}

#[component]
pub fn QuantSignalEngine() -> impl IntoView {
    let stores = use_stores();
    let symbol_memo = Memo::new(move |_| stores.selected_symbol.get());
    let signals = RwSignal::new(None::<QuantSignal>);
    let loading = RwSignal::new(true);
    let error = RwSignal::new(None::<String>);
    let last_updated = RwSignal::new(None::<f64>);
    // Previous committed signal for the meaningful-change dedupe.
    let previous = Rc::new(RefCell::new(None::<QuantSignal>));
    let generation = RwSignal::new(0u64);

    Effect::new(move |_| {
        let sym = symbol_memo.get();
        // Untracked: writing `generation` here must not re-trigger this
        // effect, or every run would spawn another poll task until OOM.
        let my_gen = generation.get_untracked().wrapping_add(1);
        generation.set(my_gen);
        let gen_cleanup = generation;
        on_cleanup(move || {
            gen_cleanup.set(gen_cleanup.get_untracked().wrapping_add(1));
        });

        let gen = generation;
        let previous = Rc::clone(&previous);
        spawn_local(async move {
            loop {
                if gen.get() != my_gen {
                    return;
                }
                match analyze_market(&sym).await {
                    Ok(next) => {
                        if gen.get() != my_gen {
                            return;
                        }
                        let should_update = match *previous.borrow() {
                            None => true,
                            Some(prev) => is_meaningful_change(&prev, &next),
                        };
                        if should_update {
                            *previous.borrow_mut() = Some(next);
                            signals.set(Some(next));
                        }
                        stores.check_market_conditions(
                            &sym,
                            next.price,
                            MarketConditionData {
                                rsi: Some(next.rsi),
                                signal: Some(signal_label(next.score).to_string()),
                                volume_ratio: Some(1.0),
                                ofi: Some(0.0),
                                ..Default::default()
                            },
                        );
                        last_updated.set(Some(now_ms()));
                        error.set(None);
                        loading.set(false);
                    }
                    Err(e) => {
                        if gen.get() != my_gen {
                            return;
                        }
                        error.set(Some(e));
                        loading.set(false);
                    }
                }
                sleep_ms(ANALYSIS_POLL_INTERVAL_MS).await;
                if gen.get() != my_gen {
                    return;
                }
            }
        });
    });

    view! {
        <Show
            when=move || loading.get() || signals.get().is_none()
            fallback=move || {
                let sig = signals.get().unwrap();
                let master = master_signal(sig.score);
                let err = error.get();
                let updated = last_updated.get();
                let rsi_color = if sig.rsi > 70.0 {
                    "var(--accent-danger)"
                } else if sig.rsi < 30.0 {
                    "var(--accent-success)"
                } else {
                    "var(--text-primary)"
                };
                let macd_color = match sig.macd_signal {
                    MacdSignal::Bullish => "var(--accent-success)",
                    MacdSignal::Bearish => "var(--accent-danger)",
                    MacdSignal::Neutral => "var(--text-secondary)",
                };
                let volatility_color = if sig.atr_percent > 1.0 {
                    "var(--accent-warning)"
                } else {
                    "var(--text-secondary)"
                };
                let bb_marker = (sig.bb_position * 100.0).clamp(0.0, 100.0);
                view! {
                    <div
                        class="panel-scroll"
                        style="font-family:var(--font-mono);display:flex;flex-direction:column;gap:16px"
                    >
                        {err.map(|e| {
                            view! {
                                <div class="freshness-line panel-degraded">
                                    {format!("DEGRADED · Latest signal retained · {e}")}
                                </div>
                            }
                        })}
                        <div
                            class="panel-body"
                            style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border-color);padding-bottom:12px"
                        >
                            <div>
                                <div class="stat-card__label" style="color:var(--text-secondary)">
                                    "HEURISTIC_SIGNAL · 15M"
                                </div>
                                <div
                                    class=format!(
                                        "{} tnum",
                                        if sig.score.abs() > STRONG_BUY_SIGNAL_THRESHOLD { "text-glow" } else { "" }
                                    )
                                    style=format!(
                                        "font-size:24px;font-weight:bold;color:{};letter-spacing:-1px",
                                        master.color()
                                    )
                                >
                                    {format!("[{}]", master.as_str())}
                                </div>
                            </div>
                            <div style="text-align:right">
                                <div class="stat-card__label" style="color:var(--text-secondary)">
                                    "MODEL SCORE"
                                </div>
                                <div class="tnum" style="font-size:18px;color:var(--text-primary)">
                                    {format!("{:.0}%", sig.score.abs())}
                                </div>
                            </div>
                        </div>
                        <div
                            class="panel-body"
                            style="padding-top:0;display:grid;grid-template-columns:1fr 1fr;gap:12px"
                        >
                            <div class="stat-card">
                                <div class="stat-card__row">
                                    <span>"RSI(14)"</span>
                                    <span class="tnum" style=format!("color:{rsi_color}")>
                                        {format!("{:.1}", sig.rsi)}
                                    </span>
                                </div>
                                <div class="gauge-track">
                                    <div
                                        class="gauge-track__marker"
                                        style=format!("left:{}%", sig.rsi)
                                    />
                                </div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-card__row">
                                    <span>"MOMENTUM"</span>
                                    <span style=format!("color:{macd_color}")>
                                        {sig.macd_signal.as_str()}
                                    </span>
                                </div>
                                <div style="display:flex;align-items:center;gap:4px;margin-top:4px">
                                    <span style=format!("font-size:12px;color:{macd_color}")>
                                        {match sig.macd_signal {
                                            MacdSignal::Bullish => "▲",
                                            MacdSignal::Bearish => "▼",
                                            MacdSignal::Neutral => "•",
                                        }}
                                    </span>
                                    <span style="font-size:10px;color:var(--text-primary)">
                                        "TREND_FOLLOWING"
                                    </span>
                                </div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-card__row">
                                    <span>"VOLATILITY"</span>
                                    <span class="tnum" style="color:var(--text-primary)">
                                        {format!("{:.2}%", sig.atr_percent)}
                                    </span>
                                </div>
                                <div style="display:flex;align-items:center;gap:4px;margin-top:4px">
                                    <span style=format!("font-size:12px;color:{volatility_color}")>"⚡"</span>
                                    <span style=format!("font-size:10px;color:{volatility_color}")>
                                        {if sig.atr_percent > 1.0 { "HIGH_EXPANSION" } else { "COMPRESSED" }}
                                    </span>
                                </div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-card__row">
                                    <span>"BB_POSITION"</span>
                                    <span class="tnum" style="color:var(--text-primary)">
                                        {format!("{:.0}%", sig.bb_position * 100.0)}
                                    </span>
                                </div>
                                <div class="gauge-track">
                                    <div
                                        class="gauge-track__marker"
                                        style=format!("left:{bb_marker}%")
                                    />
                                </div>
                            </div>
                        </div>
                        <div
                            class="panel-body insight-box"
                            style="margin-top:auto;padding-top:0"
                        >
                            <span style="font-size:14px;color:var(--accent-primary)">"●"</span>
                            <div>
                                <div class="insight-box__title">"> QUANT_INSIGHT"</div>
                                <div class="insight-box__body">
                                    {if master.is_bullish() {
                                        "RSI, BOLLINGER POSITION, AND MACD INPUTS CURRENTLY LEAN BULLISH."
                                    } else if master.is_bearish() {
                                        "RSI, BOLLINGER POSITION, AND MACD INPUTS CURRENTLY LEAN BEARISH."
                                    } else {
                                        "THE INPUTS ARE MIXED. NO DIRECTIONAL EDGE IS IMPLIED BY THIS HEURISTIC."
                                    }}
                                </div>
                            </div>
                        </div>
                        <div class="freshness-line">
                            {format!(
                                "BINANCE SPOT · Refresh 30s · {} · Not investment advice",
                                updated
                                    .map(|t| format!("Updated {}", typed::format_local_time(t)))
                                    .unwrap_or_else(|| "Waiting".to_string())
                            )}
                        </div>
                    </div>
                }
            }
        >
            {move || {
                let err = error.get();
                view! {
                    <div class="panel-body">
                        {match err {
                            Some(e) => format!("SIGNAL_ENGINE_UNAVAILABLE · {e}"),
                            None => "INITIALIZING_QUANT_ENGINE…".to_string(),
                        }}
                    </div>
                }
            }}
        </Show>
    }
}
