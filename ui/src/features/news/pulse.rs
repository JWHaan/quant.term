//! NetworkPulsePanel — port of `src/features/news/NetworkPulsePanel.tsx`.
//! Live Bitcoin network metrics from mempool.space + alternative.me,
//! refreshed every 60s with graceful per-source degradation.

use std::cell::{Cell, RefCell};
use std::rc::Rc;

use leptos::prelude::*;
use wasm_bindgen::{JsCast, JsValue};

use crate::services::rest::{fetch_json_all, IntervalGuard};
use crate::stores::now_ms;

const REFRESH_INTERVAL_MS: f64 = 60_000.0;
const FETCH_TIMEOUT_MS: f64 = 8_000.0;

const HEIGHT_URL: &str = "https://mempool.space/api/blocks/tip/height";
const FEES_URL: &str = "https://mempool.space/api/v1/fees/recommended";
const MEMPOOL_URL: &str = "https://mempool.space/api/mempool";
const FEAR_GREED_URL: &str = "https://api.alternative.me/fng/?limit=1&format=json";

#[derive(Clone, Debug)]
struct RecommendedFees {
    fastest_fee: f64,
    half_hour_fee: f64,
    hour_fee: f64,
    economy_fee: f64,
    minimum_fee: f64,
}

#[derive(Clone, Debug)]
struct MempoolStats {
    count: f64,
    vsize: f64,
    total_fee: f64,
}

#[derive(Clone, Debug)]
struct NetworkPulse {
    height: Option<f64>,
    fees: Option<RecommendedFees>,
    mempool: Option<MempoolStats>,
    sentiment: Option<f64>,
    sentiment_label: String,
    updated_at: f64,
}

/// JS `Number(value)` semantics on a serde_json value.
fn js_number(v: &serde_json::Value) -> f64 {
    match v {
        serde_json::Value::Null => 0.0,
        serde_json::Value::Bool(b) => {
            if *b {
                1.0
            } else {
                0.0
            }
        }
        serde_json::Value::Number(n) => n.as_f64().unwrap_or(f64::NAN),
        serde_json::Value::String(s) => {
            let t = s.trim();
            if t.is_empty() {
                0.0
            } else {
                t.parse::<f64>().unwrap_or(f64::NAN)
            }
        }
        serde_json::Value::Array(a) => {
            if a.len() == 1 {
                js_number(&a[0])
            } else {
                f64::NAN
            }
        }
        serde_json::Value::Object(_) => f64::NAN,
    }
}

fn as_finite_number(v: Option<&serde_json::Value>) -> Option<f64> {
    let n = js_number(v?);
    n.is_finite().then_some(n)
}

fn parse_recommended_fees(value: &serde_json::Value) -> Result<RecommendedFees, ()> {
    let record = value.as_object().ok_or(())?;
    if value.is_array() {
        return Err(());
    }
    let fees = RecommendedFees {
        fastest_fee: as_finite_number(record.get("fastestFee")).ok_or(())?,
        half_hour_fee: as_finite_number(record.get("halfHourFee")).ok_or(())?,
        hour_fee: as_finite_number(record.get("hourFee")).ok_or(())?,
        economy_fee: as_finite_number(record.get("economyFee")).ok_or(())?,
        minimum_fee: as_finite_number(record.get("minimumFee")).ok_or(())?,
    };
    if fees.fastest_fee < 0.0
        || fees.half_hour_fee < 0.0
        || fees.hour_fee < 0.0
        || fees.economy_fee < 0.0
        || fees.minimum_fee < 0.0
    {
        return Err(());
    }
    Ok(fees)
}

fn parse_mempool_stats(value: &serde_json::Value) -> Result<MempoolStats, ()> {
    let record = value.as_object().ok_or(())?;
    if value.is_array() {
        return Err(());
    }
    let count = as_finite_number(record.get("count")).ok_or(())?;
    let vsize = as_finite_number(record.get("vsize")).ok_or(())?;
    let total_fee = as_finite_number(record.get("total_fee")).ok_or(())?;
    if count < 0.0 || vsize < 0.0 || total_fee < 0.0 {
        return Err(());
    }
    Ok(MempoolStats {
        count,
        vsize,
        total_fee,
    })
}

// ─── JS formatting helpers (toLocaleString / toLocaleTimeString) ─────────────

fn js_call0_string(obj: &JsValue, method: &str) -> Option<String> {
    let f = js_sys::Reflect::get(obj, &JsValue::from_str(method)).ok()?;
    let f = f.dyn_into::<js_sys::Function>().ok()?;
    let result = f.call0(obj).ok()?;
    result.as_string()
}

#[allow(deprecated)] // Number::new returns a Number wrapper object; Number::from yields a primitive, which would break Reflect::get below
fn number_to_locale(n: f64) -> String {
    if !n.is_finite() {
        return "—".to_string();
    }
    let num = js_sys::Number::new(&JsValue::from_f64(n));
    js_call0_string(num.as_ref(), "toLocaleString")
        .unwrap_or_else(|| format!("{n}"))
}

fn time_to_locale(ts: f64) -> String {
    let date = js_sys::Date::new(&JsValue::from_f64(ts));
    js_call0_string(date.as_ref(), "toLocaleTimeString")
        .unwrap_or_else(|| "—".to_string())
}

fn format_fee_or_dash(v: Option<f64>) -> String {
    v.map(|f| {
        if f.fract() == 0.0 {
            format!("{}", f as i64)
        } else {
            format!("{f}")
        }
    })
    .unwrap_or_else(|| "—".to_string())
}

/// Live Bitcoin network pulse — 4 public sources, 60s refresh.
#[component]
pub fn NetworkPulsePanel() -> impl IntoView {
    let pulse = RwSignal::new(None::<NetworkPulse>);
    let error = RwSignal::new(None::<String>);
    let refresh_key = RwSignal::new(0u64);
    let generation = Rc::new(Cell::new(0u64));
    let guard_slot = Rc::new(RefCell::new(None::<IntervalGuard>));

    // Auto-refresh every 60s.
    {
        let refresh_key = refresh_key;
        let guard_slot = Rc::clone(&guard_slot);
        Effect::new(move |_| {
            *guard_slot.borrow_mut() = Some(IntervalGuard::start(
                REFRESH_INTERVAL_MS,
                move |_: web_sys::Event| {
                    refresh_key.update(|v| *v += 1);
                },
            ));
        });
    }

    {
        let generation = Rc::clone(&generation);
        Effect::new(move |_| {
            let _ = refresh_key.get();
            let gen = generation.get() + 1;
            generation.set(gen);
            let gen_rc = Rc::clone(&generation);

            fetch_json_all(
                vec![
                    HEIGHT_URL.to_string(),
                    FEES_URL.to_string(),
                    MEMPOOL_URL.to_string(),
                    FEAR_GREED_URL.to_string(),
                ],
                FETCH_TIMEOUT_MS,
                move |results| {
                    if gen_rc.get() != gen {
                        return;
                    }
                    let failed = results.iter().filter(|r| r.is_err()).count();
                    if failed == 4 {
                        error.set(Some("All network sources are unavailable".to_string()));
                        return;
                    }

                    // mempool.space returns a bare number; `Number(text)`
                    // semantics are preserved via js_number (string or num).
                    let height = match &results[0] {
                        Ok(v) => as_finite_number(Some(v)),
                        Err(_) => None,
                    };

                    let fees = match &results[1] {
                        Ok(v) => parse_recommended_fees(v).ok(),
                        Err(_) => None,
                    };
                    let mempool = match &results[2] {
                        Ok(v) => parse_mempool_stats(v).ok(),
                        Err(_) => None,
                    };
                    let (sentiment, sentiment_label) = match &results[3] {
                        Ok(v) => {
                            let point = v
                                .get("data")
                                .and_then(|d| d.as_array())
                                .and_then(|a| a.first());
                            let sentiment = point
                                .and_then(|p| p.get("value"))
                                .and_then(|v| as_finite_number(Some(v)));
                            let label = point
                                .and_then(|p| p.get("value_classification"))
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string());
                            (sentiment, label)
                        }
                        Err(_) => (None, None),
                    };

                    pulse.update(|prev| {
                        let previous = prev.take();
                        *prev = Some(NetworkPulse {
                            height: height
                                .or_else(|| previous.as_ref().and_then(|p| p.height)),
                            fees: fees.or_else(|| {
                                previous.as_ref().and_then(|p| p.fees.clone())
                            }),
                            mempool: mempool.or_else(|| {
                                previous.as_ref().and_then(|p| p.mempool.clone())
                            }),
                            sentiment: sentiment
                                .or_else(|| previous.as_ref().and_then(|p| p.sentiment)),
                            sentiment_label: sentiment_label
                                .or_else(|| {
                                    previous
                                        .as_ref()
                                        .map(|p| p.sentiment_label.clone())
                                })
                                .unwrap_or_else(|| "Unavailable".to_string()),
                            updated_at: now_ms(),
                        });
                    });
                    error.set(if failed > 0 {
                        Some(format!("{failed} of 4 network sources unavailable"))
                    } else {
                        None
                    });
                },
            );
        });
    }

    view! {
        {move || {
            let current = pulse.get();
            let current_error = error.get();
            if current.is_none() && current_error.is_none() {
                return view! {
                    <div class="panel-state">
                        <span class="spin" style="display:inline-block">"◌ "</span>
                        " Loading live Bitcoin network data…"
                    </div>
                }
                .into_any();
            }
            let Some(pulse_data) = current else {
                return view! {
                    <div class="panel-state panel-state--error">
                        <span>"Bitcoin network data is temporarily unavailable."</span>
                        <button
                            class="text-action"
                            on:click=move |_| refresh_key.update(|v| *v += 1)
                        >
                            <span>"⟳ "</span>" Retry"
                        </button>
                    </div>
                }
                .into_any();
            };

            let fastest_fee = pulse_data.fees.as_ref().map(|f| f.fastest_fee);
            let fee_tone = match fastest_fee {
                None => "warning",
                Some(f) if f >= 50.0 => "negative",
                Some(f) if f >= 15.0 => "warning",
                Some(_) => "positive",
            };
            let sentiment_tone = match pulse_data.sentiment {
                None => "warning",
                Some(s) if s >= 60.0 => "positive",
                Some(s) if s <= 40.0 => "negative",
                Some(_) => "warning",
            };
            let height_text = pulse_data
                .height
                .map(number_to_locale)
                .unwrap_or_else(|| "—".to_string());
            let fee_text = fastest_fee
                .map(|f| {
                    if f.fract() == 0.0 {
                        format!("{} sat/vB", f as i64)
                    } else {
                        format!("{f} sat/vB")
                    }
                })
                .unwrap_or_else(|| "—".to_string());
            let mempool_text = pulse_data
                .mempool
                .as_ref()
                .map(|m| format!("{} tx", number_to_locale(m.count)))
                .unwrap_or_else(|| "—".to_string());
            let mempool_sub = pulse_data
                .mempool
                .as_ref()
                .map(|m| format!("{:.1} MvB backlog", m.vsize / 1_000_000.0))
                .unwrap_or_else(|| "Unavailable".to_string());
            let sentiment_text = pulse_data
                .sentiment
                .map(|s| {
                    if s.fract() == 0.0 {
                        format!("{}", s as i64)
                    } else {
                        format!("{s}")
                    }
                })
                .unwrap_or_else(|| "—".to_string());
            let sentiment_label = if pulse_data.sentiment_label.is_empty() {
                "Unavailable".to_string()
            } else {
                pulse_data.sentiment_label.clone()
            };
            let fees = pulse_data.fees.clone();
            let is_degraded = current_error.is_some();
            let dot_class = if is_degraded { "" } else { "live-dot" };
            let updated_text = time_to_locale(pulse_data.updated_at);
            let status_text = current_error.clone().unwrap_or_else(|| "Public read-only sources".to_string());

            view! {
                <section class="terminal-stack" aria-label="Live Bitcoin network pulse">
                    <div class="source-line">
                        <span class=dot_class />
                        {if is_degraded { "DEGRADED" } else { "LIVE" }}
                        " · MEMPOOL.SPACE + ALTERNATIVE.ME "
                        <button
                            class="icon-action"
                            on:click=move |_| refresh_key.update(|v| *v += 1)
                            aria-label="Refresh network data"
                        >"⟳"</button>
                    </div>
                    <div class="metric-grid metric-grid--two">
                        <div class="metric-card">
                            "▦"<span>"Chain height"</span>
                            <strong>{height_text}</strong>
                            <small>"Bitcoin mainnet"</small>
                        </div>
                        <div class="metric-card">
                            "◔"<span>"Priority fee"</span>
                            <strong class=fee_tone>{fee_text}</strong>
                            <small>"Next-block estimate"</small>
                        </div>
                        <div class="metric-card">
                            "◉"<span>"Mempool"</span>
                            <strong>{mempool_text}</strong>
                            <small>{mempool_sub}</small>
                        </div>
                        <div class="metric-card">
                            "◷"<span>"Fear & Greed"</span>
                            <strong class=sentiment_tone>{sentiment_text}</strong>
                            <small>{sentiment_label}</small>
                        </div>
                    </div>
                    <div class="fee-ladder" aria-label="Recommended Bitcoin transaction fees">
                        <span><small>"30 min"</small><strong>{format_fee_or_dash(fees.as_ref().map(|f| f.half_hour_fee))}</strong></span>
                        <span><small>"60 min"</small><strong>{format_fee_or_dash(fees.as_ref().map(|f| f.hour_fee))}</strong></span>
                        <span><small>"Economy"</small><strong>{format_fee_or_dash(fees.as_ref().map(|f| f.economy_fee))}</strong></span>
                        <span><small>"Minimum"</small><strong>{format_fee_or_dash(fees.as_ref().map(|f| f.minimum_fee))}</strong></span>
                        <em>"sat/vB"</em>
                    </div>
                    <div class="freshness-line">
                        {format!("Updated {updated_text} · {status_text}")}
                    </div>
                </section>
            }
            .into_any()
        }}
    }
}
