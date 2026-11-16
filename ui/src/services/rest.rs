//! Binance REST orchestration — port of `src/integrations/binance/*`
//! (klines, watchlist, derivatives, liquidations, contracts) plus the
//! REST-driven hooks `useDerivativesSnapshot` and `useChartDataFeed`.
//!
//! Payload *parsing* lives in `quant-core` (called here through its
//! `JsValue` API); this module owns URLs, fetch, timeouts and signals.
//! All exchange data is parsed defensively — malformed payloads yield
//! `Err`/`None`, never a panic.

use std::cell::{Cell, RefCell};
use std::collections::{BTreeMap, HashMap};
use std::rc::{Rc, Weak};
use std::sync::{Arc, Mutex};

use leptos::prelude::*;
use serde::{Deserialize, Serialize};
use wasm_bindgen::closure::Closure;
use wasm_bindgen::{JsCast, JsValue};
use wasm_bindgen_futures::{spawn_local, JsFuture};
use web_sys::{window, Event, Request, RequestInit, RequestMode, Response, WebSocket};

use crate::services::binance_feed::use_binance_feed;
use crate::services::telemetry::{
    next_owner_id, record_live_market_event, release_live_connection, report_live_connection,
};
use crate::stores::{
    now_ms, to_binance_futures_symbol, use_stores, AppStores, MarketData, MarketDataUpdate,
    Ohlcv, OrderBookSnapshot, BINANCE_FUTURES_REST_URL, BINANCE_FUTURES_WS_URL,
    BINANCE_REST_URL,
};

// ─── Browser timer guards (RAII, mirror setTimeout/setInterval cleanup) ──────

/// One-shot `setTimeout` whose closure is dropped (and the timer cleared)
/// when the guard is dropped.
pub struct TimeoutGuard {
    id: i32,
    _cb: Closure<dyn FnMut(Event)>,
}

impl TimeoutGuard {
    pub fn start(ms: f64, f: impl FnMut(Event) + 'static) -> Self {
        let cb = Closure::wrap(Box::new(f) as Box<dyn FnMut(Event)>);
        let id = window()
            .and_then(|w| {
                w.set_timeout_with_callback_and_timeout_and_arguments_0(
                    cb.as_ref().unchecked_ref(),
                    ms.max(0.0) as i32,
                )
                .ok()
            })
            .unwrap_or(0);
        Self { id, _cb: cb }
    }
}

impl Drop for TimeoutGuard {
    fn drop(&mut self) {
        if self.id != 0 {
            if let Some(w) = window() {
                w.clear_timeout_with_handle(self.id);
            }
        }
    }
}

/// Recurring `setInterval` with the same RAII semantics.
pub struct IntervalGuard {
    id: i32,
    _cb: Closure<dyn FnMut(Event)>,
}

impl IntervalGuard {
    pub fn start(ms: f64, f: impl FnMut(Event) + 'static) -> Self {
        let cb = Closure::wrap(Box::new(f) as Box<dyn FnMut(Event)>);
        let id = window()
            .and_then(|w| {
                w.set_interval_with_callback_and_timeout_and_arguments_0(
                    cb.as_ref().unchecked_ref(),
                    ms.max(0.0) as i32,
                )
                .ok()
            })
            .unwrap_or(0);
        Self { id, _cb: cb }
    }
}

impl Drop for IntervalGuard {
    fn drop(&mut self) {
        if self.id != 0 {
            if let Some(w) = window() {
                w.clear_interval_with_handle(self.id);
            }
        }
    }
}

// ─── Fetch plumbing ──────────────────────────────────────────────────────────

/// Sentinel raced against fetch promises to emulate AbortSignal timeouts
/// (web-sys `AbortController` is not enabled in this build).
const FETCH_TIMEOUT_SENTINEL: &str = "__quant_term_fetch_timeout__";

#[derive(Clone, Debug)]
pub enum RestError {
    Http(u16),
    Timeout,
    Network(String),
    Parse(String),
    NoClosedCandles,
    EmptyCandles,
    UnexpectedFormat,
    PageCap,
}

impl RestError {
    pub fn message(&self) -> String {
        match self {
            RestError::Http(s) => format!("HTTP {s}"),
            RestError::Timeout => "request timed out".to_string(),
            RestError::Network(m) => m.clone(),
            RestError::Parse(m) => m.clone(),
            RestError::NoClosedCandles => {
                "Failed to fetch klines: no closed candles in response".to_string()
            }
            RestError::EmptyCandles => "Binance returned no valid candles".to_string(),
            RestError::UnexpectedFormat => "Unexpected response format".to_string(),
            RestError::PageCap => "exceeded hard page cap".to_string(),
        }
    }
}

pub(crate) fn js_err_string(v: &JsValue) -> String {
    if let Some(s) = v.as_string() {
        return s;
    }
    js_sys::JSON::stringify(v)
        .ok()
        .and_then(|s| s.as_string())
        .unwrap_or_else(|| "unknown error".to_string())
}

/// JsValue → serde_json::Value via JSON.stringify (safe for plain JSON).
pub(crate) fn js_to_json(value: &JsValue) -> Result<serde_json::Value, RestError> {
    let s = js_sys::JSON::stringify(value)
        .map_err(|_| RestError::Parse("unserializable value".to_string()))?;
    let s = s
        .as_string()
        .ok_or_else(|| RestError::Parse("unserializable value".to_string()))?;
    serde_json::from_str(&s).map_err(|e| RestError::Parse(e.to_string()))
}

fn timeout_promise(ms: f64) -> js_sys::Promise {
    js_sys::Promise::new(&mut |resolve, _reject| {
        let cb = Closure::<dyn FnMut(Event)>::new(move |_: Event| {
            let _ = resolve.call1(&JsValue::UNDEFINED, &JsValue::from_str(FETCH_TIMEOUT_SENTINEL));
        });
        if let Some(w) = window() {
            let _ = w.set_timeout_with_callback_and_timeout_and_arguments_0(
                cb.as_ref().unchecked_ref(),
                ms.max(0.0) as i32,
            );
        }
        cb.forget();
    })
}

/// GET `url` with an `accept: application/json` header, raced against a
/// `timeout_ms` deadline. Mirrors the TS `fetch` + `AbortSignal.timeout`
/// pattern; the underlying request is not aborted, only its result ignored.
pub(crate) async fn fetch_response(url: &str, timeout_ms: f64) -> Result<Response, RestError> {
    let w = window().ok_or_else(|| RestError::Network("no window".to_string()))?;
    let headers = web_sys::Headers::new()
        .map_err(|_| RestError::Network("failed to create headers".to_string()))?;
    let _ = headers.set("accept", "application/json");
    let init = RequestInit::new();
    init.set_method("GET");
    init.set_headers_headers(&headers);
    init.set_mode(RequestMode::Cors);
    let request = Request::new_with_str_and_init(url, &init)
        .map_err(|e| RestError::Network(js_err_string(&e)))?;

    let fetch_promise = w.fetch_with_request(&request);
    let timeout = timeout_promise(timeout_ms);
    let raced = js_sys::Promise::race(
        js_sys::Array::of2(fetch_promise.as_ref(), timeout.as_ref()).as_ref(),
    );
    let value = JsFuture::from(raced)
        .await
        .map_err(|e| RestError::Network(js_err_string(&e)))?;

    if value.as_string().as_deref() == Some(FETCH_TIMEOUT_SENTINEL) {
        return Err(RestError::Timeout);
    }
    let response: Response = value
        .dyn_into()
        .map_err(|_| RestError::Parse("non-Response fetch result".to_string()))?;
    if !response.ok() {
        return Err(RestError::Http(response.status()));
    }
    Ok(response)
}

async fn response_json(response: &Response) -> Result<JsValue, RestError> {
    let promise = response
        .json()
        .map_err(|e| RestError::Parse(js_err_string(&e)))?;
    JsFuture::from(promise)
        .await
        .map_err(|e| RestError::Parse(js_err_string(&e)))
}

async fn fetch_json_value(url: &str, timeout_ms: f64) -> Result<serde_json::Value, RestError> {
    let response = fetch_response(url, timeout_ms).await?;
    let value = response_json(&response).await?;
    js_to_json(&value)
}

/// Fan out JSON GETs in parallel (Promise.allSettled semantics: every slot
/// resolves to Ok/Err) and invoke `on_all` once all have settled.
pub fn fetch_json_all(
    urls: Vec<String>,
    timeout_ms: f64,
    on_all: impl FnOnce(Vec<Result<serde_json::Value, RestError>>) + 'static,
) {
    let n = urls.len();
    let slots = Rc::new(RefCell::new(
        vec![None::<Result<serde_json::Value, RestError>>; n],
    ));
    let remaining = Rc::new(Cell::new(n));
    let on_all = Rc::new(RefCell::new(Some(Box::new(on_all)
        as Box<dyn FnOnce(Vec<Result<serde_json::Value, RestError>>)>)));

    for (i, url) in urls.into_iter().enumerate() {
        let slots = Rc::clone(&slots);
        let remaining = Rc::clone(&remaining);
        let on_all = Rc::clone(&on_all);
        spawn_local(async move {
            let result = fetch_json_value(&url, timeout_ms).await;
            slots.borrow_mut()[i] = Some(result);
            if remaining.get() <= 1 {
                if let Some(cb) = on_all.borrow_mut().take() {
                    let out = slots
                        .borrow_mut()
                        .iter_mut()
                        .map(|s| {
                            s.take()
                                .unwrap_or_else(|| Err(RestError::Network("missing result".into())))
                        })
                        .collect();
                    cb(out);
                }
            } else {
                remaining.set(remaining.get() - 1);
            }
        });
    }
}

/// Small sleep used to await an in-flight shared request (news client).
pub(crate) async fn sleep_ms(ms: f64) {
    let promise = js_sys::Promise::new(&mut |resolve, _reject| {
        let cb = Closure::<dyn FnMut(Event)>::new(move |_: Event| {
            let _ = resolve.call0(&JsValue::UNDEFINED);
        });
        if let Some(w) = window() {
            let _ = w.set_timeout_with_callback_and_timeout_and_arguments_0(
                cb.as_ref().unchecked_ref(),
                ms.max(0.0) as i32,
            );
        }
        cb.forget();
    });
    let _ = JsFuture::from(promise).await;
}

// ─── klines (src/integrations/binance/klines.ts) ─────────────────────────────

/// Bar duration in seconds for every supported Binance kline interval.
pub fn interval_seconds(interval: &str) -> Option<f64> {
    quant_core::typed::interval_seconds(interval)
}

const KLINES_PATH: &str = "/api/v3/klines";
const KLINES_TIMEOUT_MS: f64 = 8_000.0;
const HISTORICAL_FETCH_TIMEOUT_MS: f64 = 8_000.0;
const DEFAULT_PAGE_LIMIT: usize = 1_000;
const MAX_BINANCE_KLINES: usize = 1_000;
const HARD_PAGE_CAP: u32 = 50;
const DEFAULT_MAX_CANDLES: usize = 20_000;
const DEFAULT_LOOKBACK_BARS: u64 = 1_000;
const NO_CLOSED_CANDLES_MESSAGE: &str =
    "Failed to fetch klines: no closed candles in response";

#[derive(Clone, Debug)]
pub struct KlinesRequest {
    pub symbol: String,
    pub interval: String,
    pub start_time: Option<f64>,
    pub end_time: Option<f64>,
    pub limit: Option<usize>,
}

#[derive(Clone, Debug)]
pub struct KlinesRangeRequest {
    pub symbol: String,
    pub interval: String,
    /// Bars to walk back from the latest closed bar; ignored when start_time is given.
    pub lookback_bars: Option<u64>,
    pub start_time: Option<f64>,
    pub end_time: Option<f64>,
    pub max_candles: Option<usize>,
}

#[derive(Clone, Debug)]
pub struct KlinesRangeResult {
    pub candles: Vec<Ohlcv>,
    pub requests: u32,
}

/// JS `String(number)` for the integer-ms timestamps used in kline params.
fn js_num(v: f64) -> String {
    if v.fract() == 0.0 && v.abs() < 9.0e15 {
        format!("{}", v as i64)
    } else {
        format!("{v}")
    }
}

/// Fetch a single page of klines; returns only closed, well-formed candles.
/// `Err(RestError::NoClosedCandles)` mirrors the TS sentinel error.
pub async fn fetch_kline_page(request: &KlinesRequest) -> Result<Vec<Ohlcv>, RestError> {
    let interval_seconds =
        interval_seconds(&request.interval).ok_or(RestError::UnexpectedFormat)?;
    let mut url = format!(
        "{BINANCE_REST_URL}{KLINES_PATH}?symbol={}&interval={}&limit={}",
        request.symbol,
        request.interval,
        request.limit.unwrap_or(DEFAULT_PAGE_LIMIT)
    );
    if let Some(t) = request.start_time {
        url.push_str(&format!("&startTime={}", js_num(t)));
    }
    if let Some(t) = request.end_time {
        url.push_str(&format!("&endTime={}", js_num(t)));
    }

    let response = fetch_response(&url, KLINES_TIMEOUT_MS).await?;
    let rows = response_json(&response).await?;
    let rows = js_to_json(&rows)?;
    let arr = rows.as_array().ok_or(RestError::UnexpectedFormat)?;
    // `quant_core::typed::parse_klines` drops malformed/unclosed rows and
    // never fails — same predicate as the TS `parseKlineRow` filter.
    let candles: Vec<Ohlcv> = quant_core::typed::parse_klines(arr, interval_seconds, now_ms())
        .into_iter()
        .map(|c| Ohlcv {
            time: c.time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume,
        })
        .collect();
    if candles.is_empty() {
        return Err(RestError::NoClosedCandles);
    }
    Ok(candles)
}

/// Page forward through klines until a short page / deadline / cap.
/// Mirrors `fetchKlinesRange` in klines.ts, including its mid-range
/// NoClosedCandles semantics (only tolerated on the first request).
pub async fn fetch_klines_range(
    request: &KlinesRangeRequest,
) -> Result<KlinesRangeResult, RestError> {
    let interval_secs =
        interval_seconds(&request.interval).ok_or(RestError::UnexpectedFormat)?;
    let interval_ms = interval_secs * 1_000.0;
    let max_candles = request.max_candles.unwrap_or(DEFAULT_MAX_CANDLES);
    // The parse predicate is the sole unclosed-bar filter, so end at now.
    let end_ms = request.end_time.unwrap_or_else(now_ms);
    let lookback_bars = request.lookback_bars.unwrap_or(DEFAULT_LOOKBACK_BARS).max(1);
    let start_ms = request
        .start_time
        .unwrap_or(end_ms - (lookback_bars as f64 - 1.0) * interval_ms);

    let mut by_time: BTreeMap<i64, Ohlcv> = BTreeMap::new();
    let mut requests = 0u32;
    let mut cursor = start_ms;

    while by_time.len() < max_candles && cursor <= end_ms {
        if requests >= HARD_PAGE_CAP {
            return Err(RestError::PageCap);
        }
        let limit = DEFAULT_PAGE_LIMIT.min(max_candles - by_time.len());
        requests += 1;
        let page_req = KlinesRequest {
            symbol: request.symbol.clone(),
            interval: request.interval.clone(),
            start_time: Some(cursor),
            end_time: Some(end_ms),
            limit: Some(limit),
        };
        let page = match fetch_kline_page(&page_req).await {
            Ok(p) => p,
            Err(e) => {
                if matches!(e, RestError::NoClosedCandles) && requests == 1 {
                    break;
                }
                return Err(e);
            }
        };

        for candle in &page {
            by_time.insert(candle.time as i64, *candle);
        }

        match page.last() {
            None => break,
            Some(_) if page.len() < limit => break,
            Some(last) => {
                cursor = last.time * 1_000.0 + interval_ms;
            }
        }
    }

    Ok(KlinesRangeResult {
        candles: by_time.into_values().collect(),
        requests,
    })
}

// ─── watchlist (src/integrations/binance/watchlist.ts) ───────────────────────

pub use crate::data::crypto_assets::{
    build_watchlist_seed_url, watchlist_symbols, CryptoAsset, TOP_CRYPTOS,
};

pub fn build_watchlist_stream_url(symbols: &[String]) -> String {
    let streams: Vec<String> = symbols
        .iter()
        .map(|s| s.to_lowercase())
        .map(|s| format!("{s}@miniTicker"))
        .collect();
    format!(
        "{}/stream?streams={}",
        crate::stores::BINANCE_WS_URL,
        streams.join("/")
    )
}

#[derive(Clone, Debug, PartialEq)]
pub struct WatchlistMarketData {
    pub symbol: String,
    pub name: String,
    pub category: String,
    pub price: f64,
    pub price_change_percent: f64,
    pub quote_volume: f64,
}

/// Result of `parseTicker`: display row + market-store update payload.
#[derive(Clone, Debug)]
pub struct ParsedTicker {
    pub display: WatchlistMarketData,
    pub store: MarketData,
}

thread_local! {
    static TOP_CRYPTOS_JS: RefCell<Option<JsValue>> = const { RefCell::new(None) };
}

fn top_cryptos_js() -> JsValue {
    TOP_CRYPTOS_JS.with(|cell| {
        let mut cell = cell.borrow_mut();
        if let Some(v) = cell.as_ref() {
            return v.clone();
        }
        let v = serde_wasm_bindgen::to_value(TOP_CRYPTOS).unwrap_or(JsValue::NULL);
        *cell = Some(v.clone());
        v
    })
}

/// Parse one Binance ticker payload (REST 24hr or miniTicker WS).
/// Returns `None` for symbols outside TOP_CRYPTOS or malformed rows.
pub fn parse_ticker(value: &JsValue) -> Option<ParsedTicker> {
    let out = quant_core::parse_ticker(value.clone(), top_cryptos_js()).ok()?;
    if out.is_null() || out.is_undefined() {
        return None;
    }
    let v = js_to_json(&out).ok()?;

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct DisplayJson {
        symbol: String,
        name: String,
        category: String,
        price: f64,
        price_change_percent: f64,
        quote_volume: f64,
    }
    #[derive(Deserialize)]
    struct OutJson {
        display: DisplayJson,
        store: MarketData,
    }
    let parsed: OutJson = serde_json::from_value(v).ok()?;
    Some(ParsedTicker {
        display: WatchlistMarketData {
            symbol: parsed.display.symbol,
            name: parsed.display.name,
            category: parsed.display.category,
            price: parsed.display.price,
            price_change_percent: parsed.display.price_change_percent,
            quote_volume: parsed.display.quote_volume,
        },
        store: parsed.store,
    })
}

/// Unwrap a combined-stream WS payload into raw ticker JSON values.
pub fn extract_ticker_values(payload: &JsValue) -> Vec<serde_json::Value> {
    let out = quant_core::extract_ticker_values(payload.clone()).unwrap_or(JsValue::NULL);
    js_to_json(&out)
        .ok()
        .and_then(|v| v.as_array().cloned())
        .unwrap_or_default()
}

// ─── contracts (src/integrations/binance/contracts.ts) ──────────────────────

#[derive(Clone, Debug, PartialEq)]
pub struct BinanceFuturesContract {
    pub spot_symbol: String,
    pub futures_symbol: String,
    pub multiplier: f64,
}

/// Resolve a spot instrument to its USDⓈ-M contract and unit multiplier.
pub fn get_binance_futures_contract(symbol: &str) -> BinanceFuturesContract {
    let fallback = || BinanceFuturesContract {
        spot_symbol: symbol.to_uppercase(),
        futures_symbol: to_binance_futures_symbol(symbol),
        multiplier: 1.0,
    };
    let Ok(js) = quant_core::futures_contract(symbol) else {
        return fallback();
    };
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct ContractJson {
        spot_symbol: String,
        futures_symbol: String,
        multiplier: f64,
    }
    js_to_json(&js)
        .ok()
        .and_then(|v| serde_json::from_value::<ContractJson>(v).ok())
        .map(|c| BinanceFuturesContract {
            spot_symbol: c.spot_symbol,
            futures_symbol: c.futures_symbol,
            multiplier: if c.multiplier.is_finite() && c.multiplier > 0.0 {
                c.multiplier
            } else {
                1.0
            },
        })
        .unwrap_or_else(fallback)
}

pub fn normalize_binance_futures_price(price: f64, multiplier: f64) -> f64 {
    quant_core::normalize_futures_price(price, multiplier)
}

pub fn normalize_binance_futures_quantity(quantity: f64, multiplier: f64) -> f64 {
    quant_core::normalize_futures_quantity(quantity, multiplier)
}

// ─── derivatives (src/integrations/binance/derivatives.ts + useDerivativesSnapshot)

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DerivativesSnapshot {
    pub mark_price: f64,
    pub index_price: f64,
    pub funding_rate: f64,
    pub next_funding_time: f64,
    pub open_interest: f64,
    pub long_account: f64,
    pub short_account: f64,
    pub updated_at: f64,
}

/// Parse and validate the three Binance Futures REST payloads.
pub fn parse_derivatives_snapshot(
    premium_payload: &JsValue,
    interest_payload: &JsValue,
    ratios_payload: &JsValue,
    expected_futures_symbol: &str,
    contract_multiplier: f64,
    received_at: f64,
) -> Result<DerivativesSnapshot, RestError> {
    let out = quant_core::parse_derivatives_snapshot(
        premium_payload.clone(),
        interest_payload.clone(),
        ratios_payload.clone(),
        expected_futures_symbol,
        contract_multiplier,
        Some(received_at),
    )
    .map_err(|e| RestError::Parse(js_err_string(&e)))?;
    let value = js_to_json(&out)?;
    serde_json::from_value(value).map_err(|e| RestError::Parse(e.to_string()))
}

const DERIVATIVES_REFRESH_MS: f64 = 30_000.0;
const DERIVATIVES_FETCH_TIMEOUT_MS: f64 = 8_000.0;

/// Reactive state returned by `use_derivatives_snapshot`.
pub struct DerivativesSnapshotState {
    pub snapshot: Memo<Option<DerivativesSnapshot>>,
    pub error: Memo<Option<String>>,
    pub is_loading: RwSignal<bool>,
    refresh_count: RwSignal<u64>,
}

impl DerivativesSnapshotState {
    pub fn refresh(&self) {
        self.refresh_count.update(|v| *v += 1);
    }
}

/// Polls Binance USDⓈ-M derivatives metrics for a spot symbol.
/// Mirrors `useDerivativesSnapshot`: independent per-instance fetch cycle,
/// 30s refresh interval, 8s per-request timeout.
pub fn use_derivatives_snapshot(symbol: Memo<String>) -> DerivativesSnapshotState {
    // snapshot keyed by the spot symbol that produced it (TS snapshotState).
    let snapshot_state = RwSignal::new(None::<(String, DerivativesSnapshot)>);
    let error_map = RwSignal::new(HashMap::<String, String>::new());
    let is_loading = RwSignal::new(true);
    let refresh_count = RwSignal::new(0u64);
    let generation = Rc::new(Cell::new(0u64));

    let snapshot = Memo::new(move |_| {
        let sym = symbol.get();
        snapshot_state.with(|s| {
            s.as_ref()
                .and_then(|(k, v)| (k == &sym).then(|| v.clone()))
        })
    });
    let error = Memo::new(move |_| {
        let sym = symbol.get();
        error_map.with(|m| m.get(&sym).cloned())
    });

    // 30s auto-refresh.
    let guard_slot = Rc::new(RefCell::new(None::<IntervalGuard>));
    {
        let guard_slot = Rc::clone(&guard_slot);
        let refresh_count = refresh_count;
        Effect::new(move |_| {
            *guard_slot.borrow_mut() = Some(IntervalGuard::start(
                DERIVATIVES_REFRESH_MS,
                move |_| {
                    refresh_count.update(|v| *v += 1);
                },
            ));
        });
    }

    {
        let generation = Rc::clone(&generation);
        Effect::new(move |_| {
            let spot = symbol.get();
            let contract = get_binance_futures_contract(&spot);
            let _ = refresh_count.get();

            let gen = generation.get() + 1;
            generation.set(gen);
            is_loading.set(true);

            let futures_symbol = contract.futures_symbol.clone();
            let multiplier = contract.multiplier;
            let spot_symbol = contract.spot_symbol.clone();
            let urls = vec![
                format!("{BINANCE_FUTURES_REST_URL}/fapi/v1/premiumIndex?symbol={futures_symbol}"),
                format!("{BINANCE_FUTURES_REST_URL}/fapi/v1/openInterest?symbol={futures_symbol}"),
                format!("{BINANCE_FUTURES_REST_URL}/futures/data/globalLongShortAccountRatio?symbol={futures_symbol}&period=5m&limit=1"),
            ];
            let generation = Rc::clone(&generation);
            let snapshot_state = snapshot_state;
            let error_map = error_map;
            let is_loading = is_loading;
            fetch_json_all(urls, DERIVATIVES_FETCH_TIMEOUT_MS, move |results| {
                if generation.get() != gen {
                    return;
                }
                is_loading.set(false);

                // Promise.all rejects on the first failure; surface that error.
                let mut first_err: Option<RestError> = None;
                let mut values: Vec<Option<serde_json::Value>> = Vec::with_capacity(3);
                for r in results {
                    match r {
                        Ok(v) => values.push(Some(v)),
                        Err(e) => {
                            if first_err.is_none() {
                                first_err = Some(e);
                            }
                            values.push(None);
                        }
                    }
                }
                if let Some(e) = first_err {
                    // Mirrors the TS catch: timeout/http get fixed strings,
                    // everything else surfaces the parser/transport message.
                    let msg = match &e {
                        RestError::Timeout => "Binance Futures request timed out".to_string(),
                        RestError::Http(s) => format!("Binance Futures returned {s}"),
                        other => other.message(),
                    };
                    error_map.update(|m| {
                        m.insert(spot_symbol.clone(), msg);
                    });
                    return;
                }

                let to_js = |v: Option<serde_json::Value>| {
                    serde_wasm_bindgen::to_value(&v.unwrap_or(serde_json::Value::Null))
                        .unwrap_or(JsValue::NULL)
                };
                let premium = to_js(values.get(0).cloned().flatten());
                let interest = to_js(values.get(1).cloned().flatten());
                let ratios = to_js(values.get(2).cloned().flatten());

                match parse_derivatives_snapshot(
                    &premium,
                    &interest,
                    &ratios,
                    &futures_symbol,
                    multiplier,
                    now_ms(),
                ) {
                    Ok(snap) => {
                        snapshot_state.set(Some((spot_symbol.clone(), snap)));
                        error_map.update(|m| {
                            m.remove(&spot_symbol);
                        });
                    }
                    Err(e) => {
                        error_map.update(|m| {
                            m.insert(spot_symbol.clone(), e.message());
                        });
                    }
                }
            });
        });
    }

    DerivativesSnapshotState {
        snapshot,
        error,
        is_loading,
        refresh_count,
    }
}

// ─── liquidations (src/integrations/binance/liquidations.ts) ────────────────

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum LiquidationSide {
    Buy,
    Sell,
}

impl LiquidationSide {
    pub fn as_str(&self) -> &'static str {
        match self {
            LiquidationSide::Buy => "BUY",
            LiquidationSide::Sell => "SELL",
        }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct Liquidation {
    pub symbol: String,
    pub side: LiquidationSide,
    pub price: f64,
    pub quantity: f64,
    pub value: f64,
    pub time: f64,
    pub is_buy: bool,
}

/// Parse a Binance Futures `!forceOrder@arr` message.
pub fn parse_binance_liquidation(value: &JsValue) -> Option<Liquidation> {
    let out = quant_core::parse_liquidation(value.clone()).ok()?;
    if out.is_null() || out.is_undefined() {
        return None;
    }
    #[derive(Deserialize)]
    struct LiquidationJson {
        symbol: String,
        side: String,
        price: f64,
        quantity: f64,
        value: f64,
        time: f64,
        #[serde(rename = "isBuy")]
        is_buy: bool,
    }
    let v = js_to_json(&out).ok()?;
    let parsed: LiquidationJson = serde_json::from_value(v).ok()?;
    let side = match parsed.side.as_str() {
        "BUY" => LiquidationSide::Buy,
        "SELL" => LiquidationSide::Sell,
        _ => return None,
    };
    Some(Liquidation {
        symbol: parsed.symbol,
        side,
        price: parsed.price,
        quantity: parsed.quantity,
        value: parsed.value,
        time: parsed.time,
        is_buy: parsed.is_buy,
    })
}

struct LiquidationInner {
    this: Weak<RefCell<LiquidationInner>>,
    active: bool,
    retry_count: u32,
    ws: Option<WebSocket>,
    retry_timer: Option<TimeoutGuard>,
    on_open: Option<Closure<dyn FnMut(Event)>>,
    on_error: Option<Closure<dyn FnMut(Event)>>,
    on_close: Option<Closure<dyn FnMut(Event)>>,
    on_message: Option<Closure<dyn FnMut(web_sys::MessageEvent)>>,
    stores: AppStores,
    callback: Rc<dyn Fn(Liquidation)>,
}

impl LiquidationInner {
    fn connect(&mut self) {
        if !self.active {
            return;
        }
        self.stores.set_connection_status(
            "futures",
            if self.retry_count > 0 {
                crate::stores::ConnectionStatus::Reconnecting
            } else {
                crate::stores::ConnectionStatus::Connecting
            },
        );
        let url = format!("{}/!forceOrder@arr", BINANCE_FUTURES_WS_URL);
        let Ok(ws) = WebSocket::new(&url) else {
            self.schedule_reconnect();
            return;
        };

        let rc = self.this.upgrade().expect("liquidation inner ref");
        let on_open = Closure::wrap(Box::new(move |_: Event| {
            rc.borrow_mut().handle_open();
        }) as Box<dyn FnMut(Event)>);
        ws.set_onopen(Some(on_open.as_ref().unchecked_ref()));

        let rc = self.this.upgrade().expect("liquidation inner ref");
        let on_message = Closure::wrap(Box::new(move |event: web_sys::MessageEvent| {
            if let Some(text) = event.data().as_string() {
                rc.borrow_mut().handle_message(&text);
            }
        }) as Box<dyn FnMut(web_sys::MessageEvent)>);
        ws.set_onmessage(Some(on_message.as_ref().unchecked_ref()));

        let rc = self.this.upgrade().expect("liquidation inner ref");
        let on_error = Closure::wrap(Box::new(move |_: Event| {
            if let Some(ws) = rc.borrow().ws.as_ref() {
                let _ = ws.close();
            }
        }) as Box<dyn FnMut(Event)>);
        ws.set_onerror(Some(on_error.as_ref().unchecked_ref()));

        let rc = self.this.upgrade().expect("liquidation inner ref");
        let on_close = Closure::wrap(Box::new(move |_: Event| {
            rc.borrow_mut().handle_close();
        }) as Box<dyn FnMut(Event)>);
        ws.set_onclose(Some(on_close.as_ref().unchecked_ref()));

        self.ws = Some(ws);
        self.on_open = Some(on_open);
        self.on_message = Some(on_message);
        self.on_error = Some(on_error);
        self.on_close = Some(on_close);
    }

    fn handle_open(&mut self) {
        if !self.active {
            return;
        }
        self.retry_count = 0;
        self.stores
            .set_connection_status("futures", crate::stores::ConnectionStatus::Connected);
    }

    fn handle_message(&mut self, text: &str) {
        if !self.active {
            return;
        }
        let parsed = match js_sys::JSON::parse(text) {
            Ok(v) => v,
            Err(_) => return,
        };
        match parse_binance_liquidation(&parsed) {
            Some(liquidation) => (self.callback)(liquidation),
            None => web_sys::console::warn_1(
                &"[Liquidations] Ignored malformed exchange message.".into(),
            ),
        }
    }

    fn handle_close(&mut self) {
        self.ws = None;
        if !self.active {
            return;
        }
        self.stores.set_connection_status(
            "futures",
            crate::stores::ConnectionStatus::Reconnecting,
        );
        let delay = (30_000u32.min(1_000u32.saturating_mul(2u32.saturating_pow(self.retry_count))))
            as f64
            + (js_sys::Math::random() * 500.0).floor();
        self.retry_count += 1;
        let rc = self.this.upgrade().expect("liquidation inner ref");
        self.retry_timer = Some(TimeoutGuard::start(delay, move |_: Event| {
            rc.borrow_mut().connect();
        }));
    }

    fn schedule_reconnect(&mut self) {
        if !self.active || self.retry_timer.is_some() {
            return;
        }
        let delay = (30_000u32.min(1_000u32.saturating_mul(2u32.saturating_pow(self.retry_count))))
            as f64
            + (js_sys::Math::random() * 500.0).floor();
        self.retry_count += 1;
        let rc = self.this.upgrade().expect("liquidation inner ref");
        self.retry_timer = Some(TimeoutGuard::start(delay, move |_: Event| {
            rc.borrow_mut().connect();
        }));
    }

    fn close(&mut self) {
        self.active = false;
        self.retry_timer = None;
        if let Some(ws) = self.ws.take() {
            ws.set_onopen(None);
            ws.set_onmessage(None);
            ws.set_onerror(None);
            ws.set_onclose(None);
            let _ = ws.close();
        }
        self.on_open = None;
        self.on_message = None;
        self.on_error = None;
        self.on_close = None;
        self.stores
            .set_connection_status("futures", crate::stores::ConnectionStatus::Disconnected);
    }
}

/// RAII guard for a running liquidation subscription.
pub struct LiquidationSubscription {
    inner: Rc<RefCell<LiquidationInner>>,
}

/// Subscribe to the Binance Futures `!forceOrder@arr` stream.
/// Mirrors `subscribeLiquidations` in liquidations.ts.
pub fn subscribe_liquidations(
    stores: AppStores,
    on_liquidation: impl Fn(Liquidation) + 'static,
) -> LiquidationSubscription {
    let inner = Rc::new_cyclic(|this| {
        RefCell::new(LiquidationInner {
            this: this.clone(),
            active: true,
            retry_count: 0,
            ws: None,
            retry_timer: None,
            on_open: None,
            on_error: None,
            on_close: None,
            on_message: None,
            stores,
            callback: Rc::new(on_liquidation),
        })
    });
    inner.borrow_mut().connect();
    LiquidationSubscription { inner }
}

impl Drop for LiquidationSubscription {
    fn drop(&mut self) {
        self.inner.borrow_mut().close();
    }
}

// ─── chart data feed (src/hooks/useChartDataFeed.ts, REST portion) ───────────
// TODO: heatmap capture/config effects depend on the order-book history
// store's heatmap API, which is not yet ported — `heatmap_enabled` is
// accepted for signature parity but currently a no-op.

#[derive(Clone, Debug)]
pub struct ChartDataFeedOptions {
    pub heatmap_enabled: bool,
    pub order_book_snapshot_symbol: Option<String>,
    pub fetch_limit: Option<usize>,
}

impl Default for ChartDataFeedOptions {
    fn default() -> Self {
        Self {
            heatmap_enabled: false,
            order_book_snapshot_symbol: None,
            fetch_limit: None,
        }
    }
}

/// Reactive outputs of `use_chart_data_feed`.
pub struct ChartDataFeed {
    pub is_connected: RwSignal<bool>,
    pub last_update: RwSignal<f64>,
    pub reconnect_count: RwSignal<u64>,
    pub latest_candle: Memo<Option<Ohlcv>>,
    pub candles: Memo<Vec<Ohlcv>>,
    pub is_loading: Memo<bool>,
    pub error: Memo<Option<String>>,
}

#[derive(Debug)]
enum HistError {
    Timeout,
    Http(u16),
    UnexpectedFormat,
    EmptyCandles,
    Network,
}

impl HistError {
    fn message(&self) -> String {
        match self {
            HistError::Timeout => "Historical candle request timed out".to_string(),
            HistError::Http(s) => format!("Failed to fetch candles ({s})"),
            HistError::UnexpectedFormat => "Unexpected kline response format".to_string(),
            HistError::EmptyCandles => "Binance returned no valid candles".to_string(),
            HistError::Network => "Failed to fetch historical candles".to_string(),
        }
    }
}

/// JS `Number(value)` coercion on a serde_json value (null→0, ""→0,
/// single-element arrays unwrap, everything else non-finite → None).
fn js_coerce_number(v: &serde_json::Value) -> Option<f64> {
    let n = match v {
        serde_json::Value::Null => 0.0,
        serde_json::Value::Bool(b) => {
            if *b {
                1.0
            } else {
                0.0
            }
        }
        serde_json::Value::Number(n) => n.as_f64()?,
        serde_json::Value::String(s) => {
            let t = s.trim();
            if t.is_empty() {
                0.0
            } else {
                t.parse::<f64>().ok()?
            }
        }
        serde_json::Value::Array(a) => {
            if a.len() == 1 {
                js_coerce_number(&a[0])?
            } else {
                return None;
            }
        }
        serde_json::Value::Object(_) => return None,
    };
    Some(n)
}

/// `parseHistoricalCandle` from useChartDataFeed.ts — NOTE: unlike
/// fetchKlinesPage this does NOT filter unclosed candles.
fn parse_historical_candle(row: &serde_json::Value) -> Option<Ohlcv> {
    let arr = row.as_array()?;
    if arr.len() < 6 {
        return None;
    }
    let mut values = [0.0f64; 6];
    for (i, slot) in values.iter_mut().enumerate() {
        let n = js_coerce_number(&arr[i])?;
        if !n.is_finite() {
            return None;
        }
        *slot = n;
    }
    Some(Ohlcv {
        time: values[0] / 1_000.0,
        open: values[1],
        high: values[2],
        low: values[3],
        close: values[4],
        volume: values[5],
    })
}

async fn fetch_historical_candles(
    symbol: &str,
    interval: &str,
    limit: usize,
) -> Result<Vec<Ohlcv>, HistError> {
    let url = format!(
        "{BINANCE_REST_URL}/api/v3/klines?symbol={symbol}&interval={interval}&limit={limit}"
    );
    let response = fetch_response(&url, HISTORICAL_FETCH_TIMEOUT_MS)
        .await
        .map_err(|e| match e {
            RestError::Timeout => HistError::Timeout,
            RestError::Http(s) => HistError::Http(s),
            _ => HistError::Network,
        })?;
    let value = response_json(&response)
        .await
        .map_err(|_| HistError::Network)?;
    let rows = js_to_json(&value).map_err(|_| HistError::UnexpectedFormat)?;
    let arr = rows.as_array().ok_or(HistError::UnexpectedFormat)?;
    let candles: Vec<Ohlcv> = arr.iter().filter_map(parse_historical_candle).collect();
    if candles.is_empty() {
        return Err(HistError::EmptyCandles);
    }
    Ok(candles)
}

fn normalize_fetch_limit(requested: Option<usize>) -> usize {
    requested
        .map(|v| v.clamp(1, MAX_BINANCE_KLINES))
        .unwrap_or(MAX_BINANCE_KLINES)
}

/// Leptos port of `useChartDataFeed`: live kline/depth feed plus a paged
/// historical REST backfill into the chart data store.
pub fn use_chart_data_feed(
    symbol: Memo<String>,
    interval: Memo<String>,
    options: ChartDataFeedOptions,
) -> ChartDataFeed {
    let stores = use_stores();
    let normalized = Memo::new(move |_| symbol.get().to_uppercase());
    let series_key = Memo::new(move |_| {
        format!("{}:{}", normalized.get(), interval.get())
    });
    let fetch_limit = normalize_fetch_limit(options.fetch_limit);
    let feed = use_binance_feed(normalized, interval);
    let heatmap_enabled = options.heatmap_enabled;
    let snapshot_symbol_opt = options.order_book_snapshot_symbol.clone();

    let error_key = RwSignal::new(String::new());
    let error_msg = RwSignal::new(None::<String>);
    let generation = Rc::new(Cell::new(0u64));
    let latest_live = Rc::new(RefCell::new(None::<(String, Ohlcv)>));
    // (symbol, interval) of the in-flight/last historical request, used to
    // clear `is_loading` when the effect re-runs or is disposed.
    let last_request_key = Arc::new(Mutex::new(None::<(String, String)>));

    // Live candle → chart store upsert.
    {
        let latest_live = Rc::clone(&latest_live);
        Effect::new(move |_| {
            if let Some(c) = feed.candle.get() {
                let candle = Ohlcv {
                    time: c.time,
                    open: c.open,
                    high: c.high,
                    low: c.low,
                    close: c.close,
                    volume: c.volume,
                };
                let key = series_key.get();
                *latest_live.borrow_mut() = Some((key, candle));
                stores.upsert_candle(&normalized.get(), &interval.get(), candle);
            }
        });
    }

    // Historical backfill.
    {
        let generation = Rc::clone(&generation);
        let last_request_key = Arc::clone(&last_request_key);
        Effect::new(move |_| {
            let sym = normalized.get();
            let int = interval.get();
            let key = series_key.get();

            // Clear loading state for the previous request's series first.
            if let Some((prev_sym, prev_int)) =
                last_request_key.lock().ok().and_then(|mut k| k.take())
            {
                stores.set_series_loading(&prev_sym, &prev_int, false);
            }
            *last_request_key.lock().unwrap_or_else(|e| e.into_inner()) =
                Some((sym.clone(), int.clone()));

            let gen = generation.get() + 1;
            generation.set(gen);
            stores.set_series_loading(&sym, &int, true);

            let stores2 = stores;
            let latest_live = Rc::clone(&latest_live);
            let error_key = error_key;
            let error_msg = error_msg;
            let generation = Rc::clone(&generation);
            let key_for_result = key.clone();
            // Clear `is_loading` for this series when the effect re-runs
            // or the owner is disposed (mirrors the TS effect cleanup).
            let cleanup_key = Arc::clone(&last_request_key);
            let cleanup_stores = stores;
            on_cleanup(move || {
                if let Ok(mut k) = cleanup_key.lock() {
                    if let Some((s, i)) = k.take() {
                        cleanup_stores.set_series_loading(&s, &i, false);
                    }
                }
            });
            spawn_local(async move {
                let result = fetch_historical_candles(&sym, &int, fetch_limit).await;
                if generation.get() != gen {
                    return;
                }
                match result {
                    Ok(candles) => {
                        error_key.set(key_for_result.clone());
                        error_msg.set(None);
                        stores2.set_historical_candles(&sym, &int, candles);
                        // Reapply any live candle that arrived mid-flight.
                        let live = latest_live.borrow().clone();
                        if let Some((k, c)) = live {
                            if k == key_for_result {
                                stores2.upsert_candle(&sym, &int, c);
                            }
                        }
                    }
                    Err(e) => {
                        error_key.set(key_for_result.clone());
                        error_msg.set(Some(e.message()));
                    }
                }
                stores2.set_series_loading(&sym, &int, false);
            });
        });
    }

    // Heatmap capture — mirrors the TS effect that converts each live
    // order-book update into an OrderBookSnapshot for the history store.
    // TODO: `heatmapOverrides` config + `buildHeatmap` aggregation are not yet
    // ported (utils/heatmap.ts); the captured snapshots are stored regardless.
    if heatmap_enabled {
        Effect::new(move |_| {
            let Some(ob) = feed.order_book.get() else {
                return;
            };
            let snapshot_symbol = snapshot_symbol_opt
                .clone()
                .map(|s| s.to_uppercase())
                .unwrap_or_else(|| normalized.get());
            stores.add_ob_snapshot(OrderBookSnapshot {
                timestamp: if ob.timestamp.is_finite() && ob.timestamp != 0.0 {
                    ob.timestamp
                } else {
                    now_ms()
                },
                bids: ob.bids.iter().map(|l| (l.price, l.size)).collect(),
                asks: ob.asks.iter().map(|l| (l.price, l.size)).collect(),
                symbol: snapshot_symbol,
            });
        });
    }

    let candles = Memo::new(move |_| {
        stores.get_candles(&normalized.get(), &interval.get())
    });
    let latest_candle = Memo::new(move |_| candles.get().last().copied());
    let is_loading = Memo::new(move |_| {
        let sym = normalized.get().to_uppercase();
        let int = interval.get();
        stores.series_meta.with(|m| {
            m.get(&sym)
                .and_then(|inner| inner.get(&int))
                .map(|s| s.is_loading)
                .unwrap_or(false)
        })
    });
    let error = Memo::new(move |_| {
        if error_key.get() == series_key.get() {
            error_msg.get()
        } else {
            None
        }
    });

    ChartDataFeed {
        is_connected: feed.is_connected,
        last_update: feed.last_update,
        reconnect_count: feed.reconnect_count,
        latest_candle,
        candles,
        is_loading,
        error,
    }
}

// ─── watchlist feed (MarketGrid.tsx ticker seed + combined stream) ───────────

const WATCHLIST_SEED_TIMEOUT_MS: f64 = 8_000.0;
const WATCHLIST_STALL_MS: f64 = 10_000.0;
const WATCHLIST_WATCHDOG_MS: f64 = 1_000.0;

/// Reactive outputs of `use_watchlist_feed`.
pub struct WatchlistFeed {
    /// Display rows keyed by symbol (TS local `marketData` Map).
    pub tickers: RwSignal<HashMap<String, WatchlistMarketData>>,
    pub loading: RwSignal<bool>,
    pub error: RwSignal<Option<String>>,
}

struct WatchlistInner {
    this: Weak<RefCell<WatchlistInner>>,
    active: bool,
    disposed: bool,
    reconnect_attempts: u32,
    last_message_at: f64,
    ws: Option<WebSocket>,
    reconnect_timer: Option<TimeoutGuard>,
    watchdog: Option<IntervalGuard>,
    on_open: Option<Closure<dyn FnMut(Event)>>,
    on_error: Option<Closure<dyn FnMut(Event)>>,
    on_close: Option<Closure<dyn FnMut(Event)>>,
    on_message: Option<Closure<dyn FnMut(web_sys::MessageEvent)>>,
    stores: AppStores,
    owner_id: usize,
    tickers: RwSignal<HashMap<String, WatchlistMarketData>>,
    loading: RwSignal<bool>,
    error: RwSignal<Option<String>>,
}

impl WatchlistInner {
    /// `applyTickers` — parse raw values, merge display rows, push store
    /// updates. Returns false when nothing usable arrived.
    fn apply_tickers(&mut self, values: &[serde_json::Value]) -> bool {
        if self.disposed {
            return false;
        }
        let mut parsed: Vec<ParsedTicker> = Vec::new();
        for v in values {
            let Ok(js) = serde_wasm_bindgen::to_value(v) else {
                continue;
            };
            if let Some(t) = parse_ticker(&js) {
                parsed.push(t);
            }
        }
        if parsed.is_empty() {
            return false;
        }

        self.tickers.update(|map| {
            for t in &parsed {
                map.insert(t.display.symbol.clone(), t.display.clone());
            }
        });
        for t in &parsed {
            let s = &t.store;
            self.stores.update_market_data(
                &s.symbol,
                MarketDataUpdate {
                    price: Some(s.price),
                    price_change: Some(s.price_change),
                    price_change_percent: Some(s.price_change_percent),
                    volume: Some(s.volume),
                    quote_volume: Some(s.quote_volume),
                    high: Some(s.high),
                    low: Some(s.low),
                    timestamp: Some(s.timestamp),
                },
            );
        }
        self.loading.set(false);
        true
    }

    fn connect(&mut self) {
        if !self.active {
            return;
        }
        report_live_connection(
            &self.stores,
            "marketData",
            self.owner_id,
            Some(if self.reconnect_attempts > 0 {
                crate::stores::ConnectionStatus::Reconnecting
            } else {
                crate::stores::ConnectionStatus::Connecting
            }),
        );
        let Ok(ws) = WebSocket::new(&build_watchlist_stream_url(&watchlist_symbols())) else {
            self.schedule_reconnect();
            return;
        };

        let rc = self.this.upgrade().expect("watchlist inner ref");
        let on_open = Closure::wrap(Box::new(move |_: Event| {
            let mut inner = rc.borrow_mut();
            if inner.disposed {
                return;
            }
            inner.last_message_at = now_ms();
        }) as Box<dyn FnMut(Event)>);
        ws.set_onopen(Some(on_open.as_ref().unchecked_ref()));

        let rc = self.this.upgrade().expect("watchlist inner ref");
        let on_message = Closure::wrap(Box::new(move |event: web_sys::MessageEvent| {
            let mut inner = rc.borrow_mut();
            if inner.disposed {
                return;
            }
            let Some(text) = event.data().as_string() else {
                return;
            };
            let Ok(payload) = js_sys::JSON::parse(&text) else {
                return;
            };
            let values = extract_ticker_values(&payload);
            if values.is_empty() || !inner.apply_tickers(&values) {
                return;
            }
            inner.last_message_at = now_ms();
            inner.reconnect_attempts = 0;
            report_live_connection(
                &inner.stores,
                "marketData",
                inner.owner_id,
                Some(crate::stores::ConnectionStatus::Connected),
            );
            inner.error.set(None);
            // Telemetry: first event's exchange timestamp (`E`/`e`) plus
            // the parsed symbol.
            let ts = values
                .first()
                .and_then(|v| v.get("E").or_else(|| v.get("e")))
                .and_then(|v| v.as_f64());
            let sym = values
                .first()
                .and_then(|v| v.get("s").or_else(|| v.get("symbol")))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            record_live_market_event("binance", ts, sym);
        }) as Box<dyn FnMut(web_sys::MessageEvent)>);
        ws.set_onmessage(Some(on_message.as_ref().unchecked_ref()));

        let rc = self.this.upgrade().expect("watchlist inner ref");
        let on_error = Closure::wrap(Box::new(move |_: Event| {
            let inner = rc.borrow_mut();
            if inner.disposed {
                return;
            }
            report_live_connection(
                &inner.stores,
                "marketData",
                inner.owner_id,
                Some(crate::stores::ConnectionStatus::Error),
            );
            if let Some(ws) = inner.ws.as_ref() {
                let _ = ws.close();
            }
        }) as Box<dyn FnMut(Event)>);
        ws.set_onerror(Some(on_error.as_ref().unchecked_ref()));

        let rc = self.this.upgrade().expect("watchlist inner ref");
        let on_close = Closure::wrap(Box::new(move |_: Event| {
            rc.borrow_mut().handle_close();
        }) as Box<dyn FnMut(Event)>);
        ws.set_onclose(Some(on_close.as_ref().unchecked_ref()));

        self.ws = Some(ws);
        self.on_open = Some(on_open);
        self.on_message = Some(on_message);
        self.on_error = Some(on_error);
        self.on_close = Some(on_close);
    }

    fn handle_close(&mut self) {
        self.ws = None;
        self.on_open = None;
        self.on_message = None;
        self.on_error = None;
        self.on_close = None;
        if self.disposed || !self.active {
            return;
        }
        self.schedule_reconnect();
    }

    fn schedule_reconnect(&mut self) {
        if self.disposed || !self.active || self.reconnect_timer.is_some() {
            return;
        }
        let delay = (30_000u32.min(1_000u32.saturating_mul(2u32.pow(self.reconnect_attempts))))
            as f64;
        self.reconnect_attempts += 1;
        report_live_connection(
            &self.stores,
            "marketData",
            self.owner_id,
            Some(crate::stores::ConnectionStatus::Reconnecting),
        );
        self.error.set(Some("Live watchlist feed reconnecting".to_string()));
        let rc = self.this.upgrade().expect("watchlist inner ref");
        self.reconnect_timer = Some(TimeoutGuard::start(delay, move |_: Event| {
            rc.borrow_mut().reconnect_timer = None;
            rc.borrow_mut().connect();
        }));
    }

    /// Watchdog — close a socket that has been silent for >10s.
    fn tick_watchdog(&mut self) {
        if self.disposed {
            return;
        }
        let stalled = self.ws.as_ref().is_some_and(|ws| {
            ws.ready_state() == WebSocket::OPEN
                && self.last_message_at > 0.0
                && now_ms() - self.last_message_at > WATCHLIST_STALL_MS
        });
        if stalled {
            self.error
                .set(Some("Live watchlist feed stalled; reconnecting".to_string()));
            if let Some(ws) = self.ws.as_ref() {
                let _ = ws.close();
            }
        }
    }

    fn teardown(&mut self) {
        self.disposed = true;
        self.active = false;
        self.reconnect_timer = None;
        self.watchdog = None;
        if let Some(ws) = self.ws.take() {
            ws.set_onopen(None);
            ws.set_onmessage(None);
            ws.set_onerror(None);
            ws.set_onclose(None);
            if ws.ready_state() == WebSocket::OPEN
                || ws.ready_state() == WebSocket::CONNECTING
            {
                let _ = ws.close();
            }
        }
        self.on_open = None;
        self.on_message = None;
        self.on_error = None;
        self.on_close = None;
        release_live_connection(&self.stores, self.owner_id);
    }
}

/// RAII guard for `use_watchlist_feed` — dropping it tears everything down.
pub struct WatchlistFeedGuard {
    inner: Rc<RefCell<WatchlistInner>>,
}

impl Drop for WatchlistFeedGuard {
    fn drop(&mut self) {
        self.inner.borrow_mut().teardown();
    }
}

/// Seed the watchlist from the 24hr ticker REST endpoint, then keep it live
/// over the combined miniTicker stream. Mirrors the MarketGrid effect:
/// 8s seed timeout, exponential reconnect backoff (1s→30s), 10s stall watchdog.
pub fn use_watchlist_feed() -> (WatchlistFeed, WatchlistFeedGuard) {
    let stores = use_stores();
    let tickers = RwSignal::new(HashMap::<String, WatchlistMarketData>::new());
    let loading = RwSignal::new(true);
    let error = RwSignal::new(None::<String>);

    let inner = Rc::new_cyclic(|this| {
        RefCell::new(WatchlistInner {
            this: this.clone(),
            active: true,
            disposed: false,
            reconnect_attempts: 0,
            last_message_at: 0.0,
            ws: None,
            reconnect_timer: None,
            watchdog: None,
            on_open: None,
            on_error: None,
            on_close: None,
            on_message: None,
            stores,
            owner_id: next_owner_id(),
            tickers,
            loading,
            error,
        })
    });

    // REST seed (best-effort; the live stream keeps flowing regardless).
    // The fetch+parse completes BEFORE borrowing `inner`, so websocket
    // handlers can never hit a double borrow_mut.
    {
        let rc = Rc::clone(&inner);
        spawn_local(async move {
            let url = build_watchlist_seed_url(&watchlist_symbols());
            let result: Result<serde_json::Value, RestError> = async {
                let response = fetch_response(&url, WATCHLIST_SEED_TIMEOUT_MS).await?;
                let value = response_json(&response).await?;
                js_to_json(&value)
            }
            .await;
            let values = result
                .as_ref()
                .ok()
                .and_then(|v| v.as_array().cloned())
                .unwrap_or_default();
            let mut inner = rc.borrow_mut();
            if inner.disposed {
                return;
            }
            match result {
                Ok(ref v) if !v.is_array() => {
                    inner.loading.set(false);
                    inner.error.set(Some("Unexpected watchlist response".to_string()));
                }
                Ok(_) => {
                    if !inner.apply_tickers(&values) {
                        inner.loading.set(false);
                        inner.error.set(Some(
                            "No current watchlist markets returned".to_string(),
                        ));
                    }
                }
                Err(e) => {
                    inner.loading.set(false);
                    let msg = if matches!(e, RestError::Timeout) {
                        "Watchlist seed timed out; waiting for live feed".to_string()
                    } else if matches!(e, RestError::Parse(_)) {
                        // `Unexpected watchlist response` for non-array JSON.
                        "Unexpected watchlist response".to_string()
                    } else {
                        e.message()
                    };
                    inner.error.set(Some(msg));
                }
            }
        });
    }

    // Live stream + watchdog. `connect()` borrows `inner` only for setup;
    // the event closures upgrade the Weak later, so no reentrancy.
    {
        let rc2 = Rc::clone(&inner);
        inner.borrow_mut().connect();
        inner.borrow_mut().watchdog = Some(IntervalGuard::start(
            WATCHLIST_WATCHDOG_MS,
            move |_: Event| {
                rc2.borrow_mut().tick_watchdog();
            },
        ));
    }

    (
        WatchlistFeed {
            tickers,
            loading,
            error,
        },
        WatchlistFeedGuard { inner },
    )
}
