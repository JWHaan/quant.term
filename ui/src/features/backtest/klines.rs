//! Binance REST klines — port of `fetchKlinesPage` / `fetchKlinesRange` /
//! `buildDatasetMeta` / `detectGaps` from `src/integrations/binance/klines.ts`.
//! Returns typed `quant_core::Candle`s parsed by the quant-core kline parser.
//! Transport (fetch + timeout race) is shared with `services::rest`.

use std::collections::BTreeMap;

use quant_core::typed;
use quant_core::Candle;
use serde_json::Value;
use wasm_bindgen_futures::JsFuture;

use crate::services::rest::{fetch_response, RestError};
use crate::stores::{now_ms, BINANCE_REST_URL};

const KLINES_PATH: &str = "/api/v3/klines";
const KLINES_TIMEOUT_MS: f64 = 8_000.0;
const DEFAULT_PAGE_LIMIT: usize = 1_000;
const HARD_PAGE_CAP: u32 = 50;
const DEFAULT_MAX_CANDLES: usize = 20_000;
const DEFAULT_LOOKBACK_BARS: f64 = 1_000.0;

#[derive(Debug)]
pub enum KlinesError {
    /// Mirrors the TS `NoClosedCandlesError` sentinel.
    NoClosedCandles,
    Timeout,
    Failed(String),
}

impl KlinesError {
    fn from_rest(e: RestError) -> Self {
        match e {
            RestError::Timeout => KlinesError::Timeout,
            RestError::NoClosedCandles => KlinesError::NoClosedCandles,
            other => KlinesError::Failed(other.message()),
        }
    }
}

impl std::fmt::Display for KlinesError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            KlinesError::NoClosedCandles => {
                write!(f, "Failed to fetch klines: no closed candles in response")
            }
            KlinesError::Timeout => write!(f, "request timed out"),
            KlinesError::Failed(m) => write!(f, "{m}"),
        }
    }
}

impl std::error::Error for KlinesError {}

/// GET `url` expecting a JSON payload. The request/timeout race is handled by
/// `services::rest::fetch_response`; the body is read as text and parsed with
/// serde so malformed payloads surface as `Err`, never a panic.
async fn fetch_json(url: &str, timeout_ms: f64) -> Result<Value, KlinesError> {
    let response = fetch_response(url, timeout_ms)
        .await
        .map_err(KlinesError::from_rest)?;
    let text_promise = response
        .text()
        .map_err(|_| KlinesError::Failed("bad response".to_string()))?;
    let text_val = JsFuture::from(text_promise)
        .await
        .map_err(|_| KlinesError::Failed("read error".to_string()))?;
    let text = text_val.as_string().unwrap_or_default();
    serde_json::from_str(&text).map_err(|e| KlinesError::Failed(format!("invalid JSON: {e}")))
}

/// JS `String(number)` for the integer-ms timestamps used in kline params.
fn js_num(v: f64) -> String {
    if v.fract() == 0.0 && v.abs() < 9.0e15 {
        format!("{}", v as i64)
    } else {
        format!("{v}")
    }
}

#[derive(Clone, Debug)]
pub struct KlinesRequest<'a> {
    pub symbol: &'a str,
    pub interval: &'a str,
    pub start_time: Option<f64>,
    pub end_time: Option<f64>,
    pub limit: Option<usize>,
}

#[derive(Clone, Debug)]
pub struct KlinesRangeRequest<'a> {
    pub symbol: &'a str,
    pub interval: &'a str,
    /// Bars to walk back from the latest closed bar; ignored when start_time is given.
    pub lookback_bars: Option<f64>,
    pub start_time: Option<f64>,
    pub end_time: Option<f64>,
    pub max_candles: Option<usize>,
}

/// Fetch a single page of klines; returns only closed, well-formed candles.
/// `Err(KlinesError::NoClosedCandles)` mirrors the TS sentinel error.
pub async fn fetch_klines_page(request: &KlinesRequest<'_>) -> Result<Vec<Candle>, KlinesError> {
    let interval_seconds = typed::interval_seconds(request.interval)
        .ok_or_else(|| KlinesError::Failed("unsupported interval".to_string()))?;
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

    let value = fetch_json(&url, KLINES_TIMEOUT_MS).await?;
    let rows = value
        .as_array()
        .ok_or_else(|| KlinesError::Failed("Unexpected kline response".to_string()))?;
    let candles = typed::parse_klines(rows, interval_seconds, now_ms());
    if candles.is_empty() {
        return Err(KlinesError::NoClosedCandles);
    }
    Ok(candles)
}

/// Page forward through klines until a short page / deadline / cap.
/// Mirrors `fetchKlinesRange` in klines.ts, including its mid-range
/// `NoClosedCandles` semantics (only tolerated on the first request).
pub async fn fetch_klines_range(
    request: &KlinesRangeRequest<'_>,
) -> Result<Vec<Candle>, KlinesError> {
    let interval_secs = typed::interval_seconds(request.interval)
        .ok_or_else(|| KlinesError::Failed("unsupported interval".to_string()))?;
    let interval_ms = interval_secs * 1_000.0;
    let max_candles = request.max_candles.unwrap_or(DEFAULT_MAX_CANDLES);
    // The parse predicate is the sole unclosed-bar filter, so end at now.
    let end_ms = request.end_time.unwrap_or_else(now_ms);
    let lookback_bars = request.lookback_bars.unwrap_or(DEFAULT_LOOKBACK_BARS).max(1.0);
    let start_ms = request
        .start_time
        .unwrap_or(end_ms - (lookback_bars - 1.0) * interval_ms);

    let mut by_time: BTreeMap<i64, Candle> = BTreeMap::new();
    let mut requests = 0u32;
    let mut cursor = start_ms;

    while by_time.len() < max_candles && cursor <= end_ms {
        if requests >= HARD_PAGE_CAP {
            return Err(KlinesError::Failed(format!(
                "Failed to fetch klines range: exceeded hard page cap ({HARD_PAGE_CAP} requests)"
            )));
        }
        let limit = DEFAULT_PAGE_LIMIT.min(max_candles - by_time.len());
        requests += 1;
        let page_req = KlinesRequest {
            symbol: request.symbol,
            interval: request.interval,
            start_time: Some(cursor),
            end_time: Some(end_ms),
            limit: Some(limit),
        };
        let page = match fetch_klines_page(&page_req).await {
            Ok(p) => p,
            Err(e) => {
                if matches!(e, KlinesError::NoClosedCandles) && requests == 1 {
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

    Ok(by_time.into_values().collect())
}

/// Latest `limit` closed candles — the single-page fetch used by the
/// analytics panels (`klines?symbol&interval&limit=N`).
pub async fn fetch_klines_latest(
    symbol: &str,
    interval: &str,
    limit: usize,
) -> Result<Vec<Candle>, KlinesError> {
    fetch_klines_page(&KlinesRequest {
        symbol,
        interval,
        start_time: None,
        end_time: None,
        limit: Some(limit),
    })
    .await
}
