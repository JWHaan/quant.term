//! Market feature components — Leptos ports of `src/features/market/*`.
//!
//! Shared infrastructure lives here: formatting helpers (port of
//! `src/utils/format.ts` + `orderBookFormatting.ts`), Binance contract
//! resolution, ticker/liquidation/derivatives payload parsers (ported from
//! `rust/quant-core`), a small reconnecting WebSocket helper, interval/timeout
//! guards, fetch helpers, tick-flash and derivatives hooks, and inline SVG
//! icons replacing `lucide-react`.

mod alert_panel;
mod liquidation_feed;
mod market_grid;
mod microstructure_ribbon;
mod order_book_dom;

pub use alert_panel::AlertPanel;
pub use liquidation_feed::LiquidationFeed;
pub use market_grid::MarketGrid;
pub use microstructure_ribbon::MicrostructureRibbon;
pub use order_book_dom::OrderBookDOM;

use leptos::prelude::*;
use serde_json::Value;
use std::cell::{Cell, RefCell};
use std::rc::Rc;
use wasm_bindgen::closure::Closure;
use wasm_bindgen::JsCast;
use web_sys::{window, Event, MessageEvent, WebSocket};

use crate::stores::{
    now_ms, AppStores, ConnectionStatus, MarketDataUpdate, BINANCE_FUTURES_REST_URL,
    BINANCE_WS_URL,
};

// ─── Formatting (src/utils/format.ts) ────────────────────────────────────────

pub(crate) fn format_price(price: f64) -> String {
    if price == 0.0 || !price.is_finite() {
        return "—".to_string();
    }
    if price > 1_000.0 {
        format!("{price:.2}")
    } else if price > 1.0 {
        format!("{price:.3}")
    } else if price < 0.0001 {
        format!("{price:.8}")
    } else {
        format!("{price:.6}")
    }
}

pub(crate) fn format_volume(num: f64, decimals: usize) -> String {
    if num == 0.0 || !num.is_finite() {
        return "—".to_string();
    }
    if num >= 1e9 {
        format!("{:.1$}B", num / 1e9, decimals)
    } else if num >= 1e6 {
        format!("{:.1$}M", num / 1e6, decimals)
    } else if num >= 1e3 {
        format!("{:.1$}K", num / 1e3, decimals)
    } else {
        format!("{:.1$}", num, decimals)
    }
}

pub(crate) fn format_percent(pct: f64, decimals: usize) -> String {
    if !pct.is_finite() {
        return "—".to_string();
    }
    let sign = if pct >= 0.0 { "+" } else { "" };
    format!("{sign}{:.1$}%", pct, decimals)
}

/// `formatBps` — explicit sign, half-up rounding stabilized against float error.
pub(crate) fn format_bps(bps: f64) -> String {
    let sign = if bps >= 0.0 { '+' } else { '-' };
    // Number((Math.abs(bps) * 100).toFixed(6))
    let stabilized = ((bps.abs() * 100.0) * 1e6).round() / 1e6;
    // Math.round(stabilized) / 100 then toFixed(2); stabilized >= 0.
    let rounded = (stabilized + 0.5).floor() / 100.0;
    format!("{sign}{rounded:.2} bps")
}

pub(crate) fn format_book_size(value: f64) -> String {
    if value >= 1_000.0 {
        format!("{value:.0}")
    } else if value >= 1.0 {
        format!("{value:.3}")
    } else {
        format!("{value:.6}")
    }
}

pub(crate) fn format_aggregation_step(step: f64) -> String {
    let decimals = (-step.log10()).ceil().max(0.0).min(8.0) as usize;
    format!("{:.1$}", step, decimals)
}

/// `getAdaptiveBookStep` from src/utils/orderBookFormatting.ts.
pub(crate) fn adaptive_book_step(reference_price: f64) -> f64 {
    if !reference_price.is_finite() || reference_price <= 0.0 {
        return 0.01;
    }
    if reference_price >= 10_000.0 {
        1.0
    } else if reference_price >= 1_000.0 {
        0.1
    } else if reference_price >= 100.0 {
        0.01
    } else if reference_price >= 1.0 {
        0.001
    } else if reference_price >= 0.1 {
        0.0001
    } else if reference_price >= 0.01 {
        0.00001
    } else if reference_price >= 0.001 {
        0.000001
    } else if reference_price >= 0.0001 {
        0.0000001
    } else {
        0.00000001
    }
}

/// LiquidationFeed `formatValue` — compact USD with $ prefix.
pub(crate) fn format_liq_value(val: f64) -> String {
    if val >= 1_000_000.0 {
        format!("${:.2}M", val / 1_000_000.0)
    } else if val >= 1_000.0 {
        format!("${:.1}K", val / 1_000.0)
    } else {
        format!("${:.0}", val)
    }
}

/// `formatCountdown` — mm:ss (h:mm:ss past an hour), floored at 00:00.
pub(crate) fn format_countdown(ms_remaining: f64) -> String {
    let total_seconds = (ms_remaining / 1000.0).floor().max(0.0) as i64;
    let hours = total_seconds / 3600;
    let minutes = (total_seconds % 3600) / 60;
    let seconds = total_seconds % 60;
    if hours > 0 {
        format!("{hours}:{minutes:02}:{seconds:02}")
    } else {
        format!("{minutes:02}:{seconds:02}")
    }
}

/// Local-time HH:MM:SS (LiquidationFeed `formatTime`).
pub(crate) fn format_hms_local(ts: f64) -> String {
    let d = js_sys::Date::new(&wasm_bindgen::JsValue::from_f64(ts));
    format!(
        "{:02}:{:02}:{:02}",
        d.get_hours(),
        d.get_minutes(),
        d.get_seconds()
    )
}

/// `date.toLocaleTimeString()` equivalent for alert rows.
pub(crate) fn format_locale_time(ts: f64) -> String {
    String::from(
        js_sys::Date::new(&wasm_bindgen::JsValue::from_f64(ts))
            .to_locale_time_string("en-US"),
    )
}

// ─── Binance USDⓈ-M contract mapping (src/integrations/binance/contracts.ts) ──

#[derive(Clone, PartialEq)]
pub(crate) struct FuturesContract {
    pub spot_symbol: String,
    pub futures_symbol: String,
    pub multiplier: f64,
}

/// Port of `futures_contract` in rust/quant-core (avoids the JsValue API).
pub(crate) fn futures_contract(symbol: &str) -> FuturesContract {
    let spot = crate::stores::normalize_binance_spot_symbol(symbol);
    let futures = crate::stores::to_binance_futures_symbol(&spot);
    fn strip(s: &str) -> &str {
        s.strip_suffix("USDT").unwrap_or(s)
    }
    let spot_base = strip(&spot);
    let futures_base = strip(&futures);
    let digits_len = futures_base.bytes().take_while(|b| b.is_ascii_digit()).count();
    let parsed_multiplier = if digits_len > 0 && digits_len < futures_base.len() {
        let (digits, rest) = futures_base.split_at(digits_len);
        if rest == spot_base {
            digits.parse::<f64>().unwrap_or(f64::NAN)
        } else {
            1.0
        }
    } else {
        1.0
    };
    let multiplier = if parsed_multiplier.is_finite() && parsed_multiplier > 0.0 {
        parsed_multiplier
    } else {
        1.0
    };
    FuturesContract {
        spot_symbol: spot,
        futures_symbol: futures,
        multiplier,
    }
}

// ─── TOP_CRYPTOS (src/data/cryptoAssets.ts) ──────────────────────────────────

use crate::data::crypto_assets::TOP_CRYPTOS;

// ─── JavaScript coercion helpers (mirroring quant-core internals) ────────────

/// `Number(value)` semantics on serde_json values.
pub(crate) fn js_to_number(v: &Value) -> f64 {
    match v {
        Value::Null => 0.0,
        Value::Bool(b) => {
            if *b {
                1.0
            } else {
                0.0
            }
        }
        Value::Number(n) => n.as_f64().unwrap_or(f64::NAN),
        Value::String(s) => js_number_string(s),
        Value::Array(arr) => {
            if arr.is_empty() {
                0.0
            } else if arr.len() == 1 {
                js_to_number(&arr[0])
            } else {
                f64::NAN
            }
        }
        Value::Object(_) => f64::NAN,
    }
}

fn js_number_string(s: &str) -> f64 {
    let t = s.trim();
    if t.is_empty() {
        return 0.0;
    }
    let lower = t.to_ascii_lowercase();
    if lower == "infinity" {
        return f64::INFINITY;
    }
    if lower == "-infinity" || lower == "+-infinity" {
        return f64::NEG_INFINITY;
    }
    if lower == "+infinity" {
        return f64::INFINITY;
    }
    let body = t
        .strip_prefix('-')
        .or_else(|| t.strip_prefix('+'))
        .unwrap_or(t);
    if body.starts_with(|c: char| c.is_ascii_alphabetic()) && !body.eq_ignore_ascii_case("infinity") {
        return f64::NAN;
    }
    t.parse::<f64>().unwrap_or(f64::NAN)
}

fn as_record(v: &Value) -> Option<&serde_json::Map<String, Value>> {
    v.as_object()
}

/// `value === null || value === undefined || value === ''`.
fn is_nullish_or_empty(v: Option<&Value>) -> bool {
    match v {
        None | Some(Value::Null) => true,
        Some(Value::String(s)) => s.is_empty(),
        _ => false,
    }
}

/// `record[key] ?? fallback` — JS `??` falls through on null/undefined only.
fn js_coalesce<'a>(rec: &'a serde_json::Map<String, Value>, keys: &[&str]) -> Option<&'a Value> {
    keys.iter().find_map(|k| rec.get(*k).filter(|v| !v.is_null()))
}

// ─── Watchlist tickers (src/integrations/binance/watchlist.ts) ───────────────

/// `WatchlistMarketData` — the display row used by MarketGrid.
#[derive(Clone, PartialEq)]
pub(crate) struct WatchlistRow {
    pub symbol: String,
    pub name: String,
    pub category: String,
    pub price: f64,
    pub price_change_percent: f64,
    pub quote_volume: f64,
}

pub(crate) fn watchlist_symbols() -> Vec<String> {
    TOP_CRYPTOS.iter().map(|a| a.symbol.to_string()).collect()
}

/// encodeURIComponent equivalent for the characters appearing in our payloads.
fn encode_uri_component(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'!' | b'~'
            | b'*' | b'\'' | b'(' | b')' => out.push(b as char),
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

pub(crate) fn build_watchlist_seed_url() -> String {
    let symbols = serde_json::to_string(&watchlist_symbols()).unwrap_or_else(|_| "[]".into());
    format!(
        "{}/api/v3/ticker/24hr?symbols={}&type=MINI",
        crate::stores::BINANCE_REST_URL,
        encode_uri_component(&symbols)
    )
}

pub(crate) fn build_watchlist_stream_url() -> String {
    let streams = watchlist_symbols()
        .iter()
        .map(|s| format!("{}@miniTicker", s.to_lowercase()))
        .collect::<Vec<_>>()
        .join("/");
    format!("{}/stream?streams={streams}", crate::stores::BINANCE_WS_URL)
}

/// `parseTicker` — returns (display row, store update).
pub(crate) fn parse_ticker(value: &Value) -> Option<(WatchlistRow, MarketDataUpdate)> {
    let ticker = as_record(value)?;
    let raw_symbol = js_coalesce(ticker, &["symbol", "s"]).and_then(Value::as_str)?;
    let symbol = raw_symbol.to_uppercase();

    let asset = TOP_CRYPTOS.iter().find(|a| a.symbol == symbol)?;

    let read_num = |long: &str, short: &str| -> f64 {
        match js_coalesce(ticker, &[long, short]) {
            Some(v) => {
                let n = js_to_number(v);
                if n.is_finite() {
                    n
                } else {
                    0.0
                }
            }
            None => 0.0,
        }
    };
    let price = read_num("lastPrice", "c");
    let mut price_change = read_num("priceChange", "p");
    let mut price_change_percent = read_num("priceChangePercent", "P");
    let open = read_num("openPrice", "o");
    if price_change == 0.0 && open > 0.0 && price > 0.0 {
        price_change = price - open;
    }
    if price_change_percent == 0.0 && open > 0.0 && price > 0.0 {
        price_change_percent = ((price - open) / open) * 100.0;
    }
    let quote_volume = read_num("quoteVolume", "q");
    if price <= 0.0 {
        return None;
    }

    let provider_ts = js_coalesce(ticker, &["eventTime", "E", "closeTime", "C"])
        .map(js_to_number)
        .unwrap_or(f64::NAN);
    let timestamp = if provider_ts.is_finite() && provider_ts > 1_000_000_000_000.0 {
        provider_ts
    } else {
        0.0
    };

    let display = WatchlistRow {
        symbol: symbol.clone(),
        name: asset.name.to_string(),
        category: asset.category.to_string(),
        price,
        price_change_percent,
        quote_volume,
    };
    let store = MarketDataUpdate {
        price: Some(price),
        price_change: Some(price_change),
        price_change_percent: Some(price_change_percent),
        volume: Some(read_num("volume", "v")),
        quote_volume: Some(quote_volume),
        high: Some(read_num("highPrice", "h")),
        low: Some(read_num("lowPrice", "l")),
        timestamp: Some(timestamp),
    };
    Some((display, store))
}

/// `extractTickerValues` — combined-stream unwrap.
pub(crate) fn extract_ticker_values(payload: &Value) -> Vec<Value> {
    match payload {
        Value::Array(arr) => arr.clone(),
        Value::Object(map) => match map.get("data") {
            Some(d @ Value::Object(_)) => vec![d.clone()],
            _ => Vec::new(),
        },
        _ => Vec::new(),
    }
}

// ─── Liquidations (src/integrations/binance/liquidations.ts) ─────────────────

#[derive(Clone)]
pub(crate) struct Liquidation {
    pub symbol: String,
    pub is_buy: bool,
    pub price: f64,
    pub quantity: f64,
    pub value: f64,
    pub time: f64,
}

/// `parseBinanceLiquidation` — returns None for non-forceOrder/malformed data.
pub(crate) fn parse_liquidation(value: &Value) -> Option<Liquidation> {
    let message = as_record(value)?;
    let is_force = message.get("e").and_then(Value::as_str) == Some("forceOrder");
    let order = message.get("o").and_then(as_record);
    let order = match (is_force, order) {
        (true, Some(o)) => o,
        _ => return None,
    };

    let first_positive = |keys: &[&str]| -> Option<f64> {
        for key in keys {
            let raw = order.get(*key);
            if is_nullish_or_empty(raw) {
                continue;
            }
            let parsed = js_to_number(raw.unwrap());
            if parsed.is_finite() && parsed > 0.0 {
                return Some(parsed);
            }
        }
        None
    };
    let price = first_positive(&["ap", "p"]);
    let quantity = first_positive(&["z", "l", "q"]);
    let time = order.get("T").map(js_to_number).unwrap_or(f64::NAN);

    let symbol = order.get("s").and_then(Value::as_str);
    let side = order.get("S").and_then(Value::as_str);
    let (symbol, side) = match (symbol, side) {
        (Some(s), Some(sd)) if sd == "BUY" || sd == "SELL" => (s, sd),
        _ => return None,
    };
    let (price, quantity) = match (price, quantity) {
        (Some(p), Some(q)) if time.is_finite() && time > 0.0 => (p, q),
        _ => return None,
    };

    Some(Liquidation {
        symbol: symbol.to_uppercase(),
        is_buy: side == "BUY",
        price,
        quantity,
        value: price * quantity,
        time,
    })
}

// ─── Derivatives snapshot (src/integrations/binance/derivatives.ts) ──────────

#[derive(Clone, PartialEq)]
pub(crate) struct DerivativesSnapshot {
    pub mark_price: f64,
    pub index_price: f64,
    pub funding_rate: f64,
    pub next_funding_time: f64,
    pub open_interest: f64,
    pub long_account: f64,
    pub short_account: f64,
    pub updated_at: f64,
}

/// `parseDerivativesSnapshot` — Err on malformed/mismatched payloads.
pub(crate) fn parse_derivatives_snapshot(
    premium: &Value,
    interest: &Value,
    ratios: &Value,
    expected_futures_symbol: &str,
    contract_multiplier: f64,
    received_at: f64,
) -> Result<DerivativesSnapshot, String> {
    let premium = as_record(premium).ok_or("Malformed premium index response")?;
    let interest = as_record(interest).ok_or("Malformed open interest response")?;
    let ratios_arr = match ratios {
        Value::Array(a) if !a.is_empty() => a,
        _ => return Err("Malformed long/short ratio response".into()),
    };
    let ratio = as_record(ratios_arr.last().unwrap()).ok_or("Malformed long/short ratio")?;

    for rec in [premium, interest, ratio] {
        if let Some(s) = rec.get("symbol").and_then(Value::as_str) {
            if s != expected_futures_symbol {
                return Err("Binance Futures returned a mismatched instrument".into());
            }
        }
    }

    let read_num = |rec: &serde_json::Map<String, Value>, key: &str, label: &str| -> Result<f64, String> {
        let raw = rec.get(key);
        if is_nullish_or_empty(raw) {
            return Err(format!("Malformed {label}"));
        }
        let parsed = js_to_number(raw.unwrap());
        if !parsed.is_finite() {
            return Err(format!("Malformed {label}"));
        }
        Ok(parsed)
    };
    let positive = |v: f64, label: &str| -> Result<f64, String> {
        if v <= 0.0 {
            return Err(format!("Malformed {label}"));
        }
        Ok(v)
    };

    let raw_mark = positive(read_num(premium, "markPrice", "mark price")?, "mark price")?;
    let raw_index = positive(read_num(premium, "indexPrice", "index price")?, "index price")?;
    let funding_rate = read_num(premium, "lastFundingRate", "funding rate")?;
    let next_funding = positive(read_num(premium, "nextFundingTime", "funding time")?, "funding time")?;
    let raw_oi = read_num(interest, "openInterest", "open interest")?;
    let long_account = read_num(ratio, "longAccount", "long account ratio")?;
    let short_account = read_num(ratio, "shortAccount", "short account ratio")?;

    if raw_oi < 0.0 {
        return Err("Malformed open interest".into());
    }
    if !(0.0..=1.0).contains(&long_account) || !(0.0..=1.0).contains(&short_account) {
        return Err("Malformed long/short account ratios".into());
    }
    if ((long_account + short_account) - 1.0).abs() > 0.02 {
        return Err("Inconsistent long/short account ratios".into());
    }

    Ok(DerivativesSnapshot {
        mark_price: raw_mark / contract_multiplier,
        index_price: raw_index / contract_multiplier,
        funding_rate,
        next_funding_time: next_funding,
        open_interest: raw_oi * contract_multiplier,
        long_account,
        short_account,
        updated_at: received_at,
    })
}

async fn fetch_derivatives_snapshot(
    futures_symbol: &str,
    multiplier: f64,
) -> Result<DerivativesSnapshot, String> {
    let base = BINANCE_FUTURES_REST_URL;
    let premium = fetch_json(&format!("{base}/fapi/v1/premiumIndex?symbol={futures_symbol}")).await?;
    let interest = fetch_json(&format!("{base}/fapi/v1/openInterest?symbol={futures_symbol}")).await?;
    let ratios = fetch_json(&format!(
        "{base}/futures/data/globalLongShortAccountRatio?symbol={futures_symbol}&period=5m&limit=1"
    ))
    .await?;
    parse_derivatives_snapshot(
        &premium,
        &interest,
        &ratios,
        futures_symbol,
        multiplier,
        now_ms(),
    )
}

/// `useDerivativesSnapshot` — poll every 30s while mounted, keyed by symbol.
pub(crate) struct DerivativesSignals {
    pub snapshot: RwSignal<Option<DerivativesSnapshot>>,
    pub error: RwSignal<Option<String>>,
}

pub(crate) fn use_derivatives_snapshot(symbol: Memo<String>) -> DerivativesSignals {
    let snapshot = RwSignal::new(None::<DerivativesSnapshot>);
    let error = RwSignal::new(None::<String>);
    let slot = Rc::new(RefCell::new(None::<PollGuard>));

    Effect::new(move |_| {
        let spot = symbol.get();
        let contract = futures_contract(&spot);
        let fut_sym = contract.futures_symbol.clone();
        let mult = contract.multiplier;

        *slot.borrow_mut() = None; // drops previous guard: alive=false + clears interval

        let alive = Rc::new(Cell::new(true));
        let spawn_fetch = {
            let alive = alive.clone();
            let snapshot = snapshot;
            let error = error;
            let fut_sym = fut_sym.clone();
            move || {
                let alive = alive.clone();
                let fut_sym = fut_sym.clone();
                leptos::task::spawn_local(async move {
                    match fetch_derivatives_snapshot(&fut_sym, mult).await {
                        Ok(s) => {
                            if alive.get() {
                                snapshot.set(Some(s));
                                error.set(None);
                            }
                        }
                        Err(e) => {
                            if alive.get() {
                                error.set(Some(e));
                            }
                        }
                    }
                });
            }
        };

        spawn_fetch(); // immediate fetch (TS runs effect on mount/refreshKey)

        let cb = Closure::wrap(Box::new(move |_: Event| spawn_fetch()) as Box<dyn FnMut(Event)>);
        let guard = PollGuard {
            alive,
            _interval: Some(IntervalGuard::new(cb, 30_000)),
            _timeout: None,
        };
        *slot.borrow_mut() = Some(guard);
    });

    DerivativesSignals { snapshot, error }
}

// ─── Tick flash (src/hooks/useTickFlash.ts) ──────────────────────────────────

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub(crate) enum TickDirection {
    Up,
    Down,
}

pub(crate) struct TickFlash {
    pub direction: RwSignal<Option<TickDirection>>,
    /// Bumps on every change so a repeated flash restarts its CSS animation.
    pub nonce: RwSignal<u64>,
}

/// First observation never flashes; equal prices ignored; identity swaps
/// silently re-baseline.
pub(crate) fn use_tick_flash(price: Memo<Option<f64>>, identity: String) -> TickFlash {
    let previous = Rc::new(RefCell::new(None::<(String, f64)>));
    let direction = RwSignal::new(None::<TickDirection>);
    let nonce = RwSignal::new(0u64);

    Effect::new(move |_| {
        let Some(p) = price.get().filter(|v| v.is_finite()) else {
            return;
        };
        let mut prev = previous.borrow_mut();
        match prev.as_ref() {
            None => *prev = Some((identity.clone(), p)),
            Some((id, _)) if *id != identity => *prev = Some((identity.clone(), p)),
            Some((_, old)) if *old == p => {}
            Some((_, old)) => {
                let dir = if p > *old {
                    TickDirection::Up
                } else {
                    TickDirection::Down
                };
                *prev = Some((identity.clone(), p));
                direction.set(Some(dir));
                nonce.update(|n| *n += 1);
            }
        }
    });

    TickFlash { direction, nonce }
}

/// Force a CSS animation on the row's price cell to restart (the React
/// version achieved this with a changing `key`).
pub(crate) fn restart_flash_animation(row_symbol: &str) {
    #[cfg(target_arch = "wasm32")]
    {
        let Some(doc) = web_sys::window().and_then(|w| w.document()) else {
            return;
        };
        let selector = format!("[data-row-symbol=\"{row_symbol}\"] .market-grid__price");
        let Ok(Some(el)) = doc.query_selector(&selector) else {
            return;
        };
        let Some(html) = el.dyn_ref::<web_sys::HtmlElement>() else {
            return;
        };
        let style = html.style();
        let _ = style.set_property("animation", "none");
        let _ = html.offset_height(); // force reflow so the reset registers
        let _ = style.remove_property("animation");
    }
    #[cfg(not(target_arch = "wasm32"))]
    let _ = row_symbol;
}

// ─── Reconnecting WebSocket helper ───────────────────────────────────────────

/// Callbacks for a `WsFeed`. `on_message` receives raw text frames.
pub(crate) struct WsHandlers {
    pub on_message: Rc<dyn Fn(&str)>,
    pub on_open: Option<Rc<dyn Fn()>>,
    pub on_close: Option<Rc<dyn Fn()>>,
    pub on_reconnect: Option<Rc<dyn Fn()>>,
    pub on_error: Option<Rc<dyn Fn()>>,
    /// Close + reconnect when the socket is open but silent for this long.
    pub stale_after_ms: f64,
    /// Extra random jitter (ms) added to reconnect backoff (liquidations feed).
    pub jitter_ms: f64,
}

impl WsHandlers {
    pub fn new(on_message: impl Fn(&str) + 'static) -> Self {
        Self {
            on_message: Rc::new(on_message),
            on_open: None,
            on_close: None,
            on_reconnect: None,
            on_error: None,
            stale_after_ms: 10_000.0,
            jitter_ms: 0.0,
        }
    }
}

struct WsShared {
    this: std::rc::Weak<RefCell<WsShared>>,
    url: String,
    handlers: WsHandlers,
    ws: Option<WebSocket>,
    on_open_cb: Option<Closure<dyn FnMut(Event)>>,
    on_msg_cb: Option<Closure<dyn FnMut(MessageEvent)>>,
    on_err_cb: Option<Closure<dyn FnMut(Event)>>,
    on_close_cb: Option<Closure<dyn FnMut(Event)>>,
    reconnect_cb: Option<Closure<dyn FnMut(Event)>>,
    watchdog_cb: Option<Closure<dyn FnMut(Event)>>,
    reconnect_timer: Option<i32>,
    watchdog_timer: Option<i32>,
    reconnect_attempts: u32,
    last_message_at: f64,
    disposed: bool,
}

impl WsShared {
    fn call_open(&self) {
        if let Some(cb) = &self.handlers.on_open {
            cb();
        }
    }
    fn call_close(&self) {
        if let Some(cb) = &self.handlers.on_close {
            cb();
        }
    }
    fn call_reconnect(&self) {
        if let Some(cb) = &self.handlers.on_reconnect {
            cb();
        }
    }
    fn call_error(&self) {
        if let Some(cb) = &self.handlers.on_error {
            cb();
        }
    }

    fn connect(&mut self) {
        if self.disposed {
            return;
        }
        let ws = match WebSocket::new(&self.url) {
            Ok(ws) => ws,
            Err(_) => {
                self.schedule_reconnect();
                return;
            }
        };

        macro_rules! hook {
            ($field:ident, $event:ty, $method:ident, $handler:ident) => {{
                let Some(rc) = self.this.upgrade() else {
                    return;
                };
                let cb = Closure::wrap(Box::new(move |ev: $event| {
                    rc.borrow_mut().$handler(ev);
                }) as Box<dyn FnMut($event)>);
                ws.$method(Some(cb.as_ref().unchecked_ref()));
                self.$field = Some(cb);
            }};
        }

        hook!(on_open_cb, Event, set_onopen, handle_open);
        hook!(on_msg_cb, MessageEvent, set_onmessage, handle_message);
        hook!(on_err_cb, Event, set_onerror, handle_error);
        hook!(on_close_cb, Event, set_onclose, handle_close);

        self.ws = Some(ws);
    }

    fn handle_open(&mut self, _: Event) {
        if self.disposed {
            return;
        }
        self.last_message_at = now_ms();
        self.reconnect_attempts = 0;
        self.call_open();
    }

    fn handle_message(&mut self, event: MessageEvent) {
        if self.disposed {
            return;
        }
        let Some(text) = event.data().as_string() else {
            return;
        };
        self.last_message_at = now_ms();
        let f = self.handlers.on_message.clone();
        f(&text);
    }

    fn handle_error(&mut self, _: Event) {
        if self.disposed {
            return;
        }
        self.call_error();
        if let Some(ws) = &self.ws {
            let _ = ws.close();
        }
    }

    fn handle_close(&mut self, _: Event) {
        if self.disposed {
            return;
        }
        self.call_close();
        self.schedule_reconnect();
    }

    fn schedule_reconnect(&mut self) {
        if self.disposed || self.reconnect_timer.is_some() {
            return;
        }
        let mut delay = 1_000.0 * 2f64.powi(self.reconnect_attempts as i32);
        delay = delay.min(30_000.0);
        self.reconnect_attempts += 1;
        if self.handlers.jitter_ms > 0.0 {
            delay += js_sys::Math::random() * self.handlers.jitter_ms;
        }
        self.call_reconnect();

        let Some(rc) = self.this.upgrade() else { return };
        let cb = Closure::wrap(Box::new(move |_: Event| {
            let mut shared = rc.borrow_mut();
            shared.reconnect_timer = None;
            shared.connect();
        }) as Box<dyn FnMut(Event)>);
        let timer = window()
            .and_then(|w| {
                w.set_timeout_with_callback_and_timeout_and_arguments_0(
                    cb.as_ref().unchecked_ref(),
                    delay as i32,
                )
                .ok()
            })
            .unwrap_or(0);
        self.reconnect_cb = Some(cb);
        self.reconnect_timer = Some(timer);
    }

    fn watchdog_tick(&mut self) {
        let now = now_ms();
        let is_open = self
            .ws
            .as_ref()
            .is_some_and(|ws| ws.ready_state() == WebSocket::OPEN);
        if is_open && self.last_message_at > 0.0 && now - self.last_message_at > self.handlers.stale_after_ms
        {
            if let Some(ws) = &self.ws {
                let _ = ws.close();
            }
        }
    }

    fn dispose(&mut self) {
        if self.disposed {
            return;
        }
        self.disposed = true;

        if let Some(id) = self.reconnect_timer.take() {
            let _ = window().map(|w| w.clear_timeout_with_handle(id));
        }
        if let Some(id) = self.watchdog_timer.take() {
            let _ = window().map(|w| w.clear_interval_with_handle(id));
        }
        self.reconnect_cb = None;
        self.watchdog_cb = None;

        if let Some(ws) = self.ws.take() {
            ws.set_onopen(None);
            ws.set_onmessage(None);
            ws.set_onerror(None);
            ws.set_onclose(None);
            if ws.ready_state() == WebSocket::OPEN || ws.ready_state() == WebSocket::CONNECTING {
                let _ = ws.close();
            }
        }
        self.on_open_cb = None;
        self.on_msg_cb = None;
        self.on_err_cb = None;
        self.on_close_cb = None;
    }
}

/// RAII guard for a running `WsFeed` — dropping disconnects and stops timers.
pub(crate) struct WsFeed {
    shared: Rc<RefCell<WsShared>>,
}

impl WsFeed {
    pub fn start(url: &str, handlers: WsHandlers) -> Self {
        let shared = Rc::new_cyclic(|this| {
            RefCell::new(WsShared {
                this: this.clone(),
                url: url.to_string(),
                handlers,
                ws: None,
                on_open_cb: None,
                on_msg_cb: None,
                on_err_cb: None,
                on_close_cb: None,
                reconnect_cb: None,
                watchdog_cb: None,
                reconnect_timer: None,
                watchdog_timer: None,
                reconnect_attempts: 0,
                last_message_at: 0.0,
                disposed: false,
            })
        });
        shared.borrow_mut().connect();

        let rc = Rc::clone(&shared);
        let cb = Closure::wrap(Box::new(move |_: Event| {
            rc.borrow_mut().watchdog_tick();
        }) as Box<dyn FnMut(Event)>);
        let watchdog_timer = window()
            .and_then(|w| {
                w.set_interval_with_callback_and_timeout_and_arguments_0(
                    cb.as_ref().unchecked_ref(),
                    1_000,
                )
                .ok()
            })
            .unwrap_or(0);
        {
            let mut s = shared.borrow_mut();
            s.watchdog_timer = Some(watchdog_timer);
            s.watchdog_cb = Some(cb);
        }

        Self { shared }
    }
}

impl Drop for WsFeed {
    fn drop(&mut self) {
        self.shared.borrow_mut().dispose();
    }
}

// ─── Liquidation subscription wiring ─────────────────────────────────────────

/// Handlers for the `!forceOrder@arr` stream, including 'futures' connection
/// status reporting (mirrors subscribeLiquidations).
pub(crate) fn liquidation_ws_handlers(
    stores: AppStores,
    on_liquidation: Rc<dyn Fn(Liquidation)>,
) -> WsHandlers {
    let mut h = WsHandlers::new(move |text| {
        if let Ok(v) = serde_json::from_str::<Value>(text) {
            if let Some(liq) = parse_liquidation(&v) {
                on_liquidation(liq);
            }
        }
    });
    h.on_open = Some(Rc::new(move || {
        stores.set_connection_status("futures", ConnectionStatus::Connected);
    }));
    h.on_close = Some(Rc::new(move || {
        stores.set_connection_status("futures", ConnectionStatus::Reconnecting);
    }));
    h.on_reconnect = Some(Rc::new(move || {
        stores.set_connection_status("futures", ConnectionStatus::Reconnecting);
    }));
    h.on_error = Some(Rc::new(move || {
        stores.set_connection_status("futures", ConnectionStatus::Error);
    }));
    h.stale_after_ms = 15_000.0;
    h.jitter_ms = 500.0;
    h
}

// ─── Aggregate trade stream (src/hooks/useAggTradeStream.ts) ─────────────────

/// `AggTradeEvent` — one `@aggTrade` message.
#[derive(Clone, Copy, Debug)]
pub(crate) struct AggTradeEvent {
    pub id: f64,
    pub price: f64,
    pub quantity: f64,
    pub timestamp: f64,
    /// `m === true` in the payload (buyer is the maker → sell-side aggression).
    pub is_buyer_maker: bool,
}

/// Parse one aggTrade payload; None when any numeric field is non-finite.
pub(crate) fn parse_agg_trade(value: &Value) -> Option<AggTradeEvent> {
    let rec = as_record(value)?;
    let trade = AggTradeEvent {
        id: rec.get("a").map(js_to_number).unwrap_or(f64::NAN),
        price: rec.get("p").map(js_to_number).unwrap_or(f64::NAN),
        quantity: rec.get("q").map(js_to_number).unwrap_or(f64::NAN),
        timestamp: rec.get("T").map(js_to_number).unwrap_or(f64::NAN),
        is_buyer_maker: rec.get("m") == Some(&Value::Bool(true)),
    };
    if [trade.id, trade.price, trade.quantity, trade.timestamp]
        .iter()
        .all(|v| v.is_finite())
    {
        Some(trade)
    } else {
        None
    }
}

/// `useAggTradeStream` — returns a signal that is true while the socket is open.
///
/// NOTE: the TS hook shares one socket per symbol across all consumers via a
/// module-level registry. This port opens one `WsFeed` per hook instance
/// (the underlying reconnect/backoff/stale-watchdog behavior is identical);
/// add a shared registry here if multiple consumers need socket sharing.
pub(crate) fn use_agg_trade_stream(
    symbol: Memo<String>,
    on_trade: Rc<dyn Fn(AggTradeEvent)>,
) -> RwSignal<bool> {
    let connected = RwSignal::new(false);
    let slot = Rc::new(RefCell::new(None::<WsFeed>));

    Effect::new(move |_| {
        let sym = symbol.get().to_uppercase();
        *slot.borrow_mut() = None; // drop previous feed (disconnects)
        connected.set(false);
        if sym.is_empty() {
            return;
        }

        let on_trade_msg = on_trade.clone();
        let conn = connected;
        let mut handlers = WsHandlers::new(move |text| {
            if let Ok(v) = serde_json::from_str::<Value>(text) {
                if let Some(trade) = parse_agg_trade(&v) {
                    on_trade_msg(trade);
                }
            }
        });
        handlers.on_open = Some(Rc::new(move || conn.set(true)));
        handlers.on_close = Some(Rc::new(move || conn.set(false)));
        handlers.on_reconnect = Some(Rc::new(move || conn.set(false)));
        handlers.on_error = Some(Rc::new(move || conn.set(false)));
        handlers.stale_after_ms = 15_000.0;

        let url = format!("{BINANCE_WS_URL}/ws/{}@aggTrade", sym.to_lowercase());
        *slot.borrow_mut() = Some(WsFeed::start(&url, handlers));
    });

    connected
}

// ─── Interval / timeout guards ───────────────────────────────────────────────

/// Owns a `setInterval` handle + its callback; clears on drop.
pub(crate) struct IntervalGuard {
    id: i32,
    _cb: Closure<dyn FnMut(Event)>,
}

impl IntervalGuard {
    pub fn new(cb: Closure<dyn FnMut(Event)>, ms: i32) -> Self {
        let id = window()
            .and_then(|w| {
                w.set_interval_with_callback_and_timeout_and_arguments_0(
                    cb.as_ref().unchecked_ref(),
                    ms,
                )
                .ok()
            })
            .unwrap_or(0);
        Self { id, _cb: cb }
    }
}

impl Drop for IntervalGuard {
    fn drop(&mut self) {
        let _ = window().map(|w| w.clear_interval_with_handle(self.id));
    }
}

/// Owns a `setTimeout` handle + its callback; clears on drop.
pub(crate) struct TimeoutGuard {
    id: i32,
    _cb: Closure<dyn FnMut(Event)>,
}

impl TimeoutGuard {
    pub fn new(cb: Closure<dyn FnMut(Event)>, ms: i32) -> Self {
        let id = window()
            .and_then(|w| {
                w.set_timeout_with_callback_and_timeout_and_arguments_0(
                    cb.as_ref().unchecked_ref(),
                    ms,
                )
                .ok()
            })
            .unwrap_or(0);
        Self { id, _cb: cb }
    }
}

impl Drop for TimeoutGuard {
    fn drop(&mut self) {
        let _ = window().map(|w| w.clear_timeout_with_handle(self.id));
    }
}

/// Guard for polling loops: dropping flips `alive` so in-flight async tasks
/// know not to touch (possibly disposed) signals.
pub(crate) struct PollGuard {
    pub alive: Rc<Cell<bool>>,
    pub _interval: Option<IntervalGuard>,
    pub _timeout: Option<TimeoutGuard>,
}

impl Drop for PollGuard {
    fn drop(&mut self) {
        self.alive.set(false);
    }
}

// ─── fetch helpers ───────────────────────────────────────────────────────────

#[cfg(target_arch = "wasm32")]
pub(crate) async fn fetch_json(url: &str) -> Result<Value, String> {
    use wasm_bindgen_futures::JsFuture;
    let window = web_sys::window().ok_or_else(|| "no window".to_string())?;
    let resp_val = JsFuture::from(window.fetch_with_str(url))
        .await
        .map_err(|_| "network error".to_string())?;
    let resp: web_sys::Response = resp_val
        .dyn_into()
        .map_err(|_| "bad response".to_string())?;
    if !resp.ok() {
        return Err(format!("HTTP {}", resp.status()));
    }
    let text_promise = resp.text().map_err(|_| "bad body".to_string())?;
    let text_val = JsFuture::from(text_promise)
        .await
        .map_err(|_| "read error".to_string())?;
    let text = text_val.as_string().unwrap_or_default();
    serde_json::from_str(&text).map_err(|e| format!("invalid JSON: {e}"))
}

#[cfg(not(target_arch = "wasm32"))]
pub(crate) async fn fetch_json(_url: &str) -> Result<Value, String> {
    Err("unsupported platform".into())
}

// ─── localStorage helpers ────────────────────────────────────────────────────

#[cfg(target_arch = "wasm32")]
pub(crate) fn ls_get(key: &str) -> Option<String> {
    web_sys::window()?
        .local_storage()
        .ok()
        .flatten()?
        .get_item(key)
        .ok()?
}

#[cfg(target_arch = "wasm32")]
pub(crate) fn ls_set(key: &str, value: &str) {
    if let Some(storage) = web_sys::window().and_then(|w| w.local_storage().ok().flatten()) {
        let _ = storage.set_item(key, value);
    }
}

#[cfg(not(target_arch = "wasm32"))]
pub(crate) fn ls_get(_key: &str) -> Option<String> {
    None
}

#[cfg(not(target_arch = "wasm32"))]
pub(crate) fn ls_set(_key: &str, _value: &str) {}

// ─── Icons (lucide-react replacements; stroke=currentColor, 24 viewBox) ─────

macro_rules! icon {
    ($name:ident, $size:expr, $($inner:tt)*) => {
        #[component]
        pub(crate) fn $name(#[prop(default = $size)] size: u32) -> impl IntoView {
            view! {
                <svg
                    width=size
                    height=size
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                >
                    $($inner)*
                </svg>
            }
        }
    };
}

icon!(IconBell, 12, <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>);
icon!(IconBellOff, 12, <path d="M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 0 .6 5"/><path d="M17 17H3s3-2 3-9a4.67 4.67 0 0 1 .3-1.7"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/><path d="m2 2 20 20"/>);
icon!(IconPlus, 12, <path d="M5 12h14"/><path d="M12 5v14"/>);
icon!(IconTrash, 12,
    <path d="M3 6h18"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    <line x1="10" x2="10" y1="11" y2="17"/>
    <line x1="14" x2="14" y1="11" y2="17"/>
);
icon!(IconSearch, 13, <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>);
icon!(IconX, 12, <path d="M18 6 6 18"/><path d="m6 6 12 12"/>);
icon!(IconTrendingDown, 12, <polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><path d="M16 17h6v-6"/>);
icon!(IconTrendingUp, 12, <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><path d="M16 7h6v6"/>);
icon!(IconDroplets, 24,
    <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/>
    <path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/>
);
