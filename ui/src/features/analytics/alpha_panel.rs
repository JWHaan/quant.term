//! Alpha factor panel — port of `src/features/analytics/AlphaPanel.tsx`.
//! Polls Binance klines every `MARKET_POLL_INTERVAL_MS` (the caller supplies
//! the interval; the TS default is `15m`), computes the same factor scores
//! through `quant_core::typed`, and embeds the OFI / Volume Delta / VPIN
//! microstructure panels.

use leptos::prelude::*;
use quant_core::typed;
use quant_core::Candle;
use wasm_bindgen_futures::spawn_local;

use crate::features::backtest::klines::{self, KlinesError};
use crate::services::rest::sleep_ms;
use crate::stores::{MARKET_POLL_INTERVAL_MS, DEFAULT_SYMBOL};

use super::ofi::OfiIndicator;
use super::vpin::VpinIndicator;
use super::volume_delta::VolumeDeltaIndicator;

const ALPHA_KLINE_LIMIT: usize = 500;
const MIN_KLINE_HISTORY: usize = 200;

#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
enum MarketCondition {
    Bull,
    Bear,
    #[default]
    Static,
    Volatile,
}

impl MarketCondition {
    fn as_str(&self) -> &'static str {
        match self {
            MarketCondition::Bull => "BULL",
            MarketCondition::Bear => "BEAR",
            MarketCondition::Static => "STATIC",
            MarketCondition::Volatile => "VOLATILE",
        }
    }
    fn color(&self) -> &'static str {
        match self {
            MarketCondition::Bull => "var(--accent-success)",
            MarketCondition::Bear => "var(--accent-danger)",
            MarketCondition::Volatile => "#FFFF00",
            MarketCondition::Static => "var(--text-muted)",
        }
    }
    /// Glyph standing in for the lucide icons (▲/▼/⚡/•).
    fn glyph(&self) -> &'static str {
        match self {
            MarketCondition::Bull => "▲",
            MarketCondition::Bear => "▼",
            MarketCondition::Volatile => "⚡",
            MarketCondition::Static => "•",
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
enum Regime {
    Trending,
    MeanReversion,
    #[default]
    RandomWalk,
}

impl Regime {
    fn as_str(&self) -> &'static str {
        match self {
            Regime::Trending => "TRENDING",
            Regime::MeanReversion => "MEAN_REVERSION",
            Regime::RandomWalk => "RANDOM_WALK",
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
enum ObvTrend {
    Bullish,
    Bearish,
    #[default]
    Neutral,
}

impl ObvTrend {
    fn as_str(&self) -> &'static str {
        match self {
            ObvTrend::Bullish => "BULLISH",
            ObvTrend::Bearish => "BEARISH",
            ObvTrend::Neutral => "NEUTRAL",
        }
    }
    fn color(&self) -> &'static str {
        match self {
            ObvTrend::Bullish => "var(--accent-success)",
            ObvTrend::Bearish => "var(--accent-danger)",
            ObvTrend::Neutral => "var(--text-muted)",
        }
    }
}

#[derive(Clone, Copy, Default)]
struct FactorScores {
    trend: f64,
    momentum: f64,
    volatility: f64,
    volume: f64,
    total: f64,
}

#[derive(Clone, Default)]
struct AlphaState {
    loaded: bool,
    regime: Regime,
    market_condition: MarketCondition,
    hurst: f64,
    adx: f64,
    rsi: f64,
    atr_percent: f64,
    obv_trend: ObvTrend,
    scores: FactorScores,
}

/// Computed factors (everything in `AlphaState` except `loaded`).
#[derive(Clone, Default)]
struct AlphaFactors {
    regime: Regime,
    market_condition: MarketCondition,
    hurst: f64,
    adx: f64,
    rsi: f64,
    atr_percent: f64,
    obv_trend: ObvTrend,
    scores: FactorScores,
}

fn initial_state() -> AlphaState {
    AlphaState {
        loaded: false,
        regime: Regime::RandomWalk,
        market_condition: MarketCondition::Static,
        hurst: 0.5,
        adx: 0.0,
        rsi: 50.0,
        atr_percent: 0.0,
        obv_trend: ObvTrend::Neutral,
        scores: FactorScores::default(),
    }
}

fn score_color(score: f64) -> &'static str {
    if score > 20.0 {
        "var(--accent-success)"
    } else if score < -20.0 {
        "var(--accent-danger)"
    } else {
        "var(--text-muted)"
    }
}

/// Port of `computeAlphaFactors` — identical scoring math. Every quant-core
/// call returns `Result`, surfaced as `Err` like the TS throw paths.
fn compute_alpha_factors(data: &[Candle]) -> Result<AlphaFactors, String> {
    let hurst = typed::hurst(data)?;
    let regime = if hurst > 0.55 {
        Regime::Trending
    } else if hurst < 0.45 {
        Regime::MeanReversion
    } else {
        Regime::RandomWalk
    };

    let adx_series = typed::adx(data, 14)?;
    let adx = adx_series.last().map(|v| v.value).unwrap_or(0.0);

    let ema50 = typed::ema(data, 50)?;
    let last_ema = ema50.last().map(|v| v.value).unwrap_or(0.0);
    let prev_idx = ema50.len().saturating_sub(11);
    let prev_ema = ema50.get(prev_idx).map(|v| v.value).unwrap_or(0.0);
    let ema_slope = if prev_ema != 0.0 {
        (last_ema - prev_ema) / prev_ema
    } else {
        0.0
    };

    let mut trend_score = 0.0;
    if adx > 25.0 {
        trend_score += 50.0;
    }
    if ema_slope.abs() > 0.005 {
        trend_score += 50.0 * ema_slope.signum();
    }

    let rsi_series = typed::rsi(data, 14)?;
    let rsi = if rsi_series.is_empty() {
        50.0
    } else {
        rsi_series.last().map(|v| v.value).unwrap_or(50.0)
    };
    let macd_series = typed::macd(data, 12, 26, 9)?;
    let macd_hist = macd_series.last().map(|v| v.histogram);

    let mut momentum_score = 0.0;
    momentum_score += if rsi > 50.0 { 25.0 } else { -25.0 };
    momentum_score += match macd_hist {
        Some(h) if h > 0.0 => 25.0,
        _ => -25.0,
    };

    let atr_series = typed::atr(data, 14)?;
    let atr = atr_series.last().map(|v| v.value).unwrap_or(0.0);
    let last_close = data.last().map(|c| c.close).unwrap_or(0.0);
    let atr_percent = if last_close != 0.0 {
        (atr / last_close) * 100.0
    } else {
        0.0
    };

    let bb_series = typed::bollinger_bands(data, 20, 2.0)?;
    let bb_width = bb_series
        .last()
        .filter(|bb| bb.middle != 0.0)
        .map(|bb| (bb.upper - bb.lower) / bb.middle)
        .unwrap_or(0.0);

    let mut volatility_score = 0.0;
    if atr_percent > 1.0 {
        volatility_score += 50.0;
    }
    if bb_width > 0.05 {
        volatility_score += 50.0;
    }

    let obv_series = typed::obv(data)?;
    let obv_last = obv_series.last().map(|v| v.value).unwrap_or(0.0);
    let obv_prev_idx = obv_series.len().saturating_sub(21);
    let obv_prev = obv_series.get(obv_prev_idx).map(|v| v.value).unwrap_or(0.0);
    let obv_change = obv_last - obv_prev;

    let vwap_series = typed::vwap(data)?;
    let vwap = vwap_series.last().map(|v| v.value).unwrap_or(0.0);
    let price_to_vwap = if vwap != 0.0 {
        (last_close - vwap) / vwap
    } else {
        0.0
    };

    let mut volume_score = 0.0;
    volume_score += if obv_change > 0.0 { 50.0 } else { -50.0 };
    volume_score += if price_to_vwap > 0.0 { 25.0 } else { -25.0 };

    let obv_trend = if obv_change > 0.0 {
        ObvTrend::Bullish
    } else if obv_change < 0.0 {
        ObvTrend::Bearish
    } else {
        ObvTrend::Neutral
    };

    let market_condition = if atr_percent > 1.5 {
        MarketCondition::Volatile
    } else if last_close > last_ema && rsi > 55.0 {
        MarketCondition::Bull
    } else if last_close <= last_ema && rsi < 45.0 {
        MarketCondition::Bear
    } else {
        MarketCondition::Static
    };

    let total_score = trend_score * 0.4 + momentum_score * 0.3 + volume_score * 0.3;

    Ok(AlphaFactors {
        regime,
        market_condition,
        hurst,
        adx,
        rsi,
        atr_percent,
        obv_trend,
        scores: FactorScores {
            trend: trend_score,
            momentum: momentum_score,
            volatility: volatility_score,
            volume: volume_score,
            total: total_score.clamp(-100.0, 100.0),
        },
    })
}

async fn fetch_alpha_factors(symbol: &str, interval: &str) -> Result<AlphaFactors, String> {
    let candles = klines::fetch_klines_latest(symbol, interval, ALPHA_KLINE_LIMIT)
        .await
        .map_err(|e| match e {
            KlinesError::Timeout => "Factor request timed out".to_string(),
            other => other.to_string(),
        })?;
    if candles.len() < MIN_KLINE_HISTORY {
        return Err("Insufficient kline history".to_string());
    }
    compute_alpha_factors(&candles)
}

/// `symbol`/`interval` props mirror the TS `AlphaPanelProps`
/// (`symbol = DEFAULT_SYMBOL`, `interval = '15m'`). `Option` props are
/// optional in Leptos, so `<AlphaPanel />` uses the same defaults.
#[component]
pub fn AlphaPanel(
    symbol: Option<Memo<String>>,
    interval: Option<Memo<String>>,
) -> impl IntoView {
    let symbol = symbol.unwrap_or_else(|| Memo::new(move |_| DEFAULT_SYMBOL.to_string()));
    let interval = interval.unwrap_or_else(|| Memo::new(move |_| "15m".to_string()));
    let state = RwSignal::new(initial_state());
    let error = RwSignal::new(None::<String>);
    // Generation counter — the Leptos equivalent of the TS AbortController +
    // `disposed` checks; bumped on every effect run and on cleanup.
    let generation = RwSignal::new(0u64);

    Effect::new(move |_| {
        let sym = symbol.get();
        let int = interval.get();
        let my_gen = generation.get_untracked().wrapping_add(1);
        generation.set(my_gen);
        let gen_cleanup = generation;
        on_cleanup(move || {
            gen_cleanup.set(gen_cleanup.get_untracked().wrapping_add(1));
        });

        let gen = generation;
        spawn_local(async move {
            loop {
                if gen.get() != my_gen {
                    return;
                }
                match fetch_alpha_factors(&sym, &int).await {
                    Ok(factors) => {
                        if gen.get() != my_gen {
                            return;
                        }
                        state.update(|s| {
                            s.loaded = true;
                            s.regime = factors.regime;
                            s.market_condition = factors.market_condition;
                            s.hurst = factors.hurst;
                            s.adx = factors.adx;
                            s.rsi = factors.rsi;
                            s.atr_percent = factors.atr_percent;
                            s.obv_trend = factors.obv_trend;
                            s.scores = factors.scores;
                        });
                        error.set(None);
                    }
                    Err(e) => {
                        if gen.get() != my_gen {
                            return;
                        }
                        // TS logs to console; the panel surfaces the message.
                        error.set(Some(e));
                    }
                }
                sleep_ms(MARKET_POLL_INTERVAL_MS).await;
                if gen.get() != my_gen {
                    return;
                }
            }
        });
    });

    view! {
        <Show
            when=move || !state.get().loaded
            fallback=move || {
                let s = state.get();
                let err = error.get();
                let factor_rows = [
                    ("TREND", s.scores.trend, format!("{:.1} ADX", s.adx)),
                    ("MOMENTUM", s.scores.momentum, format!("{:.1} RSI", s.rsi)),
                    ("VOLATILITY", s.scores.volatility, format!("{:.2}% ATR", s.atr_percent)),
                    ("VOLUME", s.scores.volume, s.obv_trend.as_str().to_string()),
                ];
                view! {
                    <div class="panel-scroll panel-body">
                        {err.map(|e| {
                            view! {
                                <div class="freshness-line panel-degraded">
                                    {format!("DEGRADED · Latest factors retained · {e}")}
                                </div>
                            }
                        })}
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
                            <div class="stat-card">
                                <div class="stat-card__label">"MARKET_REGIME"</div>
                                <div
                                    class="stat-card__value"
                                    style=format!(
                                        "color:{};display:flex;align-items:center;gap:6px",
                                        s.market_condition.color()
                                    )
                                >
                                    <span>{s.market_condition.glyph()}</span>
                                    <span>{format!("[{}]", s.market_condition.as_str())}</span>
                                </div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-card__label">"ALPHA_SCORE"</div>
                                <div
                                    class="stat-card__value tnum"
                                    style=format!("color:{}", score_color(s.scores.total))
                                >
                                    {format!("{}{}", if s.scores.total > 0.0 { "+" } else { "" }, s.scores.total.round() as i64)}
                                </div>
                            </div>
                        </div>
                        <div style="margin-bottom:16px">
                            <div class="panel-section-title">"> FACTOR_ANALYSIS"</div>
                            <div style="display:flex;flex-direction:column;gap:4px">
                                {factor_rows.iter().map(|(label, score, value)| {
                                    view! {
                                        <div
                                            class="factor-row"
                                            style=format!("border-left:2px solid {}", score_color(*score))
                                        >
                                            <span class="factor-row__label">{*label}</span>
                                            <div style="display:flex;gap:12px">
                                                <span class="factor-row__meta tnum">{value.clone()}</span>
                                                <span
                                                    class="factor-row__score tnum"
                                                    style=format!("color:{}", score_color(*score))
                                                >
                                                    {format!("{}{}", if *score > 0.0 { "+" } else { "" }, fmt_score(*score))}
                                                </span>
                                            </div>
                                        </div>
                                    }
                                }).collect::<Vec<_>>()}
                            </div>
                        </div>
                        <div>
                            <div class="panel-section-title">"> DEEP_DIVE"</div>
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11px">
                                <div class="stat-card">
                                    <div class="stat-card__label">"HURST_EXP"</div>
                                    <div class="tnum" style="color:var(--text-primary)">
                                        {format!("{:.3}", s.hurst)}
                                    </div>
                                    <div class="stat-card__sub">{s.regime.as_str()}</div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-card__label">"OBV_TREND"</div>
                                    <div style=format!("color:{}", s.obv_trend.color())>
                                        {format!("[{}]", s.obv_trend.as_str())}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div style="margin-top:16px">
                            <div class="panel-section-title">"> ORDER_FLOW_IMBALANCE"</div>
                            <OfiIndicator symbol=symbol/>
                        </div>
                        <div style="margin-top:16px">
                            <div class="panel-section-title">"> VOL_DELTA_CVD"</div>
                            <VolumeDeltaIndicator symbol=symbol/>
                        </div>
                        <div style="margin-top:16px">
                            <div class="panel-section-title">"> VPIN_TOXICITY"</div>
                            <VpinIndicator symbol=symbol/>
                        </div>
                    </div>
                }
            }
        >
            {move || {
                let err = error.get();
                view! {
                    <div class="panel-loading">
                        {match err {
                            Some(e) => view! {
                                <span>{format!("[FACTOR_FEED_UNAVAILABLE] · {e} · RETRYING")}</span>
                            }.into_any(),
                            None => view! {
                                <span>"[CALCULATING_ALPHA_FACTORS]…"</span>
                            }.into_any(),
                        }}
                    </div>
                }
            }}
        </Show>
    }
}

/// JS `{score}` number rendering for the factor score column (integers print
/// without decimals).
fn fmt_score(score: f64) -> String {
    if score.fract() == 0.0 {
        format!("{}", score as i64)
    } else {
        format!("{score}")
    }
}
