//! Port of `src/features/charts/ChartContainer.tsx` + `useChartDataFeed.ts`:
//! interval/indicator toolbar, live kline + depth feed wiring into the
//! shared stores, historical REST backfill, and the heatmap strip.

use leptos::prelude::*;
use serde_json::Value;
use wasm_bindgen_futures::JsFuture;

use crate::stores::{now_ms, use_stores, AppStores, Ohlcv, OrderBookSnapshot, BINANCE_REST_URL};

use super::canvas_chart::{IndicatorToggles, TerminalChart};
use super::data_quality::DataQualityBadge;
use super::heatmap::{aggregate_heatmap, HeatmapBinConfig, HeatmapStrip};
use super::TimeRange;

const INTERVALS: [&str; 6] = ["1m", "5m", "15m", "1h", "4h", "1d"];
const MAX_BINANCE_KLINES: u32 = 1_000;
const HISTORICAL_FETCH_TIMEOUT_MS: f64 = 8_000.0;

const INDICATOR_BUTTONS: [(&str, &str); 4] = [
    ("ema9", "EMA9"),
    ("ema21", "EMA21"),
    ("macd", "MACD"),
    ("rsi", "RSI"),
];

/// Parse one Binance kline REST row (`[t,o,h,l,c,v,...]`, values may be
/// numbers or strings) into an `Ohlcv` with `time` in seconds.
fn parse_historical_candle(row: &Value) -> Option<Ohlcv> {
    let arr = row.as_array()?;
    if arr.len() < 6 {
        return None;
    }
    let num = |i: usize| -> Option<f64> {
        match arr.get(i)? {
            Value::Number(n) => n.as_f64(),
            Value::String(s) => s.trim().parse::<f64>().ok(),
            _ => None,
        }
    };
    let time = num(0)?;
    let open = num(1)?;
    let high = num(2)?;
    let low = num(3)?;
    let close = num(4)?;
    let volume = num(5)?;
    if [time, open, high, low, close, volume]
        .iter()
        .any(|v| !v.is_finite())
    {
        return None;
    }
    Some(Ohlcv {
        time: time / 1000.0,
        open,
        high,
        low,
        close,
        volume,
    })
}

/// `fetchHistoricalCandles` — GET klines, parse defensively.
#[cfg(target_arch = "wasm32")]
async fn fetch_historical_candles(
    symbol: &str,
    interval: &str,
    limit: u32,
) -> Result<Vec<Ohlcv>, String> {
    use crate::services::rest::{fetch_response, RestError};
    let url = format!(
        "{BINANCE_REST_URL}/api/v3/klines?symbol={}&interval={}&limit={limit}",
        js_sys::encode_uri_component(symbol),
        js_sys::encode_uri_component(interval),
    );
    let resp = fetch_response(&url, HISTORICAL_FETCH_TIMEOUT_MS)
        .await
        .map_err(|e| match e {
            RestError::Timeout => "Historical candle request timed out".to_string(),
            RestError::Http(s) => format!("Failed to fetch candles ({s})"),
            _ => "Failed to fetch historical candles".to_string(),
        })?;
    let text_promise = resp.text().map_err(|_| "bad response".to_string())?;
    let text_val = JsFuture::from(text_promise)
        .await
        .map_err(|_| "Failed to read candle response".to_string())?;
    let text = text_val.as_string().unwrap_or_default();
    let raw: Value = serde_json::from_str(&text)
        .map_err(|_| "Unexpected kline response format".to_string())?;
    let rows = raw.as_array().ok_or("Unexpected kline response format")?;
    let candles: Vec<Ohlcv> = rows.iter().filter_map(parse_historical_candle).collect();
    if candles.is_empty() {
        return Err("Binance returned no valid candles".to_string());
    }
    Ok(candles)
}

#[cfg(not(target_arch = "wasm32"))]
async fn fetch_historical_candles(
    _symbol: &str,
    _interval: &str,
    _limit: u32,
) -> Result<Vec<Ohlcv>, String> {
    Err("fetch unavailable".to_string())
}

fn candles_for(
    stores: &AppStores,
    symbol: &str,
    interval: &str,
) -> Vec<Ohlcv> {
    let sym = symbol.to_uppercase();
    let iv = interval.to_string();
    stores
        .candles
        .with(|m| m.get(&sym).and_then(|inner| inner.get(&iv)).cloned())
        .unwrap_or_default()
}

fn is_loading_for(stores: &AppStores, symbol: &str, interval: &str) -> bool {
    let sym = symbol.to_uppercase();
    let iv = interval.to_string();
    stores
        .series_meta
        .with(|m| {
            m.get(&sym)
                .and_then(|inner| inner.get(&iv))
                .map(|meta| meta.is_loading)
                .unwrap_or(false)
        })
}

#[component]
pub fn ChartContainer(symbol: Memo<String>) -> impl IntoView {
    let stores = use_stores();

    let interval = RwSignal::new("1m".to_string());
    let interval_memo = Memo::new(move |_| interval.get());
    let toggles = RwSignal::new(IndicatorToggles {
        ema9: true,
        ema21: false,
        macd: false,
        rsi: false,
    });
    let show_heatmap = RwSignal::new(true);
    // (seriesKey, range) — mirrors the TS rangeState guard.
    let range_state = RwSignal::new((String::new(), None::<TimeRange>));
    let error_state = RwSignal::new((String::new(), None::<String>));
    let request_id = RwSignal::new(0u64);
    // Latest live candle seen per series, reapplied after REST backfill.
    let latest_live = std::rc::Rc::new(std::cell::RefCell::new(
        None::<(String, Ohlcv)>,
    ));

    let series_key = Memo::new(move |_| format!("{}:{}", symbol.get().to_uppercase(), interval.get()));

    let candles = Memo::new(move |_| candles_for(&stores, &symbol.get(), &interval.get()));
    let is_loading = Memo::new(move |_| is_loading_for(&stores, &symbol.get(), &interval.get()));
    let error = Memo::new(move |_| {
        let (key, msg) = error_state.get();
        if key == series_key.get() {
            msg
        } else {
            None
        }
    });
    let visible_range = Memo::new(move |_| {
        let key = series_key.get();
        let (stored_key, range) = range_state.get();
        if stored_key == key {
            range
        } else {
            None
        }
    });

    // ── Live feed (wasm only — binance_feed is gated to wasm32) ───────────
    #[cfg(target_arch = "wasm32")]
    let feed = {
        use crate::services::binance_feed::use_binance_feed;
        use_binance_feed(symbol, interval_memo)
    };
    #[cfg(target_arch = "wasm32")]
    let is_connected = Memo::new(move |_| feed.is_connected.get());
    #[cfg(not(target_arch = "wasm32"))]
    let is_connected = Memo::new(|_| false);

    #[cfg(target_arch = "wasm32")]
    let live_for_candle = std::rc::Rc::clone(&latest_live);
    #[cfg(target_arch = "wasm32")]
    Effect::new(move |_| {
        let candle = feed.candle.get();
        let Some(candle) = candle else { return };
        let sym = symbol.get();
        let intv = interval.get();
        let key = format!("{}:{}", sym.to_uppercase(), intv);
        *live_for_candle.borrow_mut() = Some((key, candle));
        stores.upsert_candle(&sym, &intv, candle);
    });

    #[cfg(target_arch = "wasm32")]
    Effect::new(move |_| {
        let enabled = show_heatmap.get();
        let book = feed.order_book.get();
        let Some(book) = book else { return };
        if !enabled {
            return;
        }
        let sym = symbol.get().to_uppercase();
        let snapshot = OrderBookSnapshot {
            timestamp: book.timestamp,
            bids: book.bids.iter().map(|l| (l.price, l.size)).collect(),
            asks: book.asks.iter().map(|l| (l.price, l.size)).collect(),
            symbol: sym,
        };
        stores.add_ob_snapshot(snapshot);
    });

    // ── Historical backfill on symbol/interval change ─────────────────────
    Effect::new(move |_| {
        let sym = symbol.get();
        let intv = interval.get();
        let key = format!("{}:{}", sym.to_uppercase(), intv);
        request_id.update(|r| *r += 1);
        let my_id = request_id.get_untracked();

        stores.set_series_loading(&sym, &intv, true);
        error_state.set((key.clone(), None));

        let stores2 = stores;
        let live = std::rc::Rc::clone(&latest_live);
        wasm_bindgen_futures::spawn_local(async move {
            let result = fetch_historical_candles(&sym, &intv, MAX_BINANCE_KLINES).await;

            if request_id.get_untracked() != my_id {
                return;
            }
            match result {
                Ok(historical) => {
                    error_state.set((key.clone(), None));
                    stores2.set_historical_candles(&sym, &intv, historical);
                    // Re-apply a live candle that arrived mid-flight.
                    let live_snapshot = live.borrow().clone();
                    if let Some((live_key, candle)) = live_snapshot {
                        if live_key == key {
                            stores2.upsert_candle(&sym, &intv, candle);
                        }
                    }
                }
                Err(msg) => {
                    let timed_out = msg.contains("timed out");
                    let message = if timed_out {
                        "Historical candle request timed out".to_string()
                    } else {
                        msg
                    };
                    error_state.set((key, Some(message)));
                }
            }
            stores2.set_series_loading(&sym, &intv, false);
        });
    });

    // ── Heatmap aggregation memo ──────────────────────────────────────────
    let heatmap = Memo::new(move |_| {
        if !show_heatmap.get() {
            return None;
        }
        let snaps = stores.ob_snapshots.get();
        if snaps.is_empty() {
            return None;
        }
        Some(aggregate_heatmap(
            &symbol.get().to_uppercase(),
            &snaps,
            &HeatmapBinConfig::default(),
            now_ms(),
        ))
    });
    let on_visible_range_change = move |range: Option<TimeRange>| {
        let key = series_key.get_untracked();
        range_state.set((key, range));
    };

    view! {
        <div style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; background: var(--chart-bg, #0f172a)">
            <div style="position: relative; flex: 1; min-height: 0">
                <TerminalChart
                    symbol=symbol
                    interval=interval_memo
                    candles=candles
                    is_loading=is_loading
                    error=error
                    is_connected=is_connected
                    indicator_toggles=toggles
                    on_visible_range_change=on_visible_range_change
                />
                <div class="chart-toolbar">
                    <DataQualityBadge symbol=symbol />

                    <div class="chart-toolbar__group" role="group" aria-label="Timeframe">
                        {INTERVALS.iter().map(|tf| {
                            let tf = *tf;
                            view! {
                                <button
                                    type="button"
                                    class=move || if interval.get() == tf { "chart-tool-btn is-active" } else { "chart-tool-btn" }
                                    aria-pressed=move || if interval.get() == tf { "true" } else { "false" }
                                    aria-label=format!("Use {tf} candles")
                                    on:click=move |_| interval.set(tf.to_string())
                                >{tf}</button>
                            }
                        }).collect_view()}
                    </div>

                    <div class="chart-toolbar__group" role="group" aria-label="Overlays">
                        <button
                            type="button"
                            class=move || if show_heatmap.get() { "chart-tool-btn is-active" } else { "chart-tool-btn" }
                            aria-pressed=move || if show_heatmap.get() { "true" } else { "false" }
                            on:click=move |_| show_heatmap.update(|v| *v = !*v)
                        >"📊 Heatmap"</button>
                        {INDICATOR_BUTTONS.iter().map(|(key, label)| {
                            let key = *key;
                            let label = *label;
                            view! {
                                <button
                                    type="button"
                                    class=move || {
                                        let t = toggles.get();
                                        let on = match key {
                                            "ema9" => t.ema9,
                                            "ema21" => t.ema21,
                                            "macd" => t.macd,
                                            _ => t.rsi,
                                        };
                                        if on {
                                            format!("chart-tool-btn chart-tool-btn--indicator-{key} is-active")
                                        } else {
                                            format!("chart-tool-btn chart-tool-btn--indicator-{key}")
                                        }
                                    }
                                    aria-pressed=move || {
                                        let t = toggles.get();
                                        let on = match key {
                                            "ema9" => t.ema9,
                                            "ema21" => t.ema21,
                                            "macd" => t.macd,
                                            _ => t.rsi,
                                        };
                                        if on { "true" } else { "false" }
                                    }
                                    on:click=move |_| toggles.update(|t| match key {
                                        "ema9" => t.ema9 = !t.ema9,
                                        "ema21" => t.ema21 = !t.ema21,
                                        "macd" => t.macd = !t.macd,
                                        _ => t.rsi = !t.rsi,
                                    })
                                >{label}</button>
                            }
                        }).collect_view()}
                    </div>
                </div>
            </div>

            {move || show_heatmap.get().then(|| {
                view! {
                    <HeatmapStrip heatmap=heatmap visible_range=visible_range height=72.0 />
                }
            })}
        </div>
    }
}
