use std::collections::{HashMap, VecDeque};
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;

#[derive(Clone, Copy, Debug, PartialEq, serde::Deserialize, serde::Serialize)]
pub struct Candle {
    pub time: f64,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct IndicatorValue {
    pub time: f64,
    pub value: f64,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct BollingerBandsValue {
    pub time: f64,
    pub upper: f64,
    pub middle: f64,
    pub lower: f64,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct MacdValue {
    pub time: f64,
    pub macd: f64,
    pub signal: f64,
    pub histogram: f64,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OfiResult {
    pub buy_volume: f64,
    pub sell_volume: f64,
    pub net_volume: f64,
    pub imbalance_ratio: f64,
}

#[derive(Debug, serde::Deserialize)]
struct TradeInput {
    quantity: serde_json::Value,
    #[serde(rename = "isBuyerMaker")]
    is_buyer_maker: bool,
}

fn js_err(msg: &str) -> JsValue {
    js_sys::Error::new(msg).unchecked_into()
}

fn validate(data: &[Candle], min_length: usize) -> Result<(), JsValue> {
    if data.len() < min_length {
        return Err(js_err(&format!(
            "Insufficient data: need at least {} candles, got {}",
            min_length,
            data.len()
        )));
    }
    let first = &data[0];
    if !first.close.is_finite() {
        return Err(js_err("Invalid close price in data"));
    }
    Ok(())
}

fn candles_from(value: JsValue) -> Result<Vec<Candle>, JsValue> {
    serde_wasm_bindgen::from_value(value).map_err(|e| js_err(&e.to_string()))
}

fn out<T: serde::Serialize>(v: Vec<T>) -> Result<JsValue, JsValue> {
    serde_wasm_bindgen::to_value(&v).map_err(|e| js_err(&e.to_string()))
}

fn ema_values(values: &[f64], period: usize) -> Vec<f64> {
    if values.is_empty() {
        return Vec::new();
    }
    let k = 2.0 / (period as f64 + 1.0);
    let mut ema = vec![values[0]];
    for i in 1..values.len() {
        ema.push(values[i] * k + ema[i - 1] * (1.0 - k));
    }
    ema
}

#[wasm_bindgen]
pub fn calculate_vwap(data: JsValue) -> Result<JsValue, JsValue> {
    let data = candles_from(data)?;
    validate(&data, 1)?;
    let mut cumulative_tpv = 0.0f64;
    let mut cumulative_volume = 0.0f64;
    let mut result = Vec::with_capacity(data.len());
    for c in &data {
        let typical_price = (c.high + c.low + c.close) / 3.0;
        cumulative_tpv += typical_price * c.volume;
        cumulative_volume += c.volume;
        let vwap = if cumulative_volume == 0.0 {
            0.0
        } else {
            cumulative_tpv / cumulative_volume
        };
        result.push(IndicatorValue {
            time: c.time,
            value: vwap,
        });
    }
    out(result)
}

#[wasm_bindgen]
pub fn calculate_sma(data: JsValue, period: u32) -> Result<JsValue, JsValue> {
    let data = candles_from(data)?;
    let period = period as usize;
    validate(&data, period)?;
    if period == 0 {
        return out(Vec::<IndicatorValue>::new());
    }
    let mut result = Vec::new();
    for i in period - 1..data.len() {
        let sum: f64 = data[i + 1 - period..=i].iter().map(|c| c.close).sum();
        result.push(IndicatorValue {
            time: data[i].time,
            value: sum / period as f64,
        });
    }
    out(result)
}

#[wasm_bindgen]
pub fn calculate_ema(data: JsValue, period: u32) -> Result<JsValue, JsValue> {
    let data = candles_from(data)?;
    let period = period as usize;
    validate(&data, period)?;
    if period == 0 {
        return out(Vec::<IndicatorValue>::new());
    }
    let k = 2.0 / (period as f64 + 1.0);
    let mut ema: f64 = data[..period].iter().map(|c| c.close).sum::<f64>() / period as f64;
    let mut result = vec![IndicatorValue {
        time: data[period - 1].time,
        value: ema,
    }];
    for candle in &data[period..] {
        ema = candle.close * k + ema * (1.0 - k);
        result.push(IndicatorValue {
            time: candle.time,
            value: ema,
        });
    }
    out(result)
}

#[wasm_bindgen]
pub fn calculate_rsi(data: JsValue, period: u32) -> Result<JsValue, JsValue> {
    let data = candles_from(data)?;
    let period = period as usize;
    validate(&data, period + 1)?;
    let mut gains = 0.0f64;
    let mut losses = 0.0f64;
    for i in 1..=period {
        let change = data[i].close - data[i - 1].close;
        if change > 0.0 {
            gains += change;
        } else {
            losses += change.abs();
        }
    }
    let mut avg_gain = gains / period as f64;
    let mut avg_loss = losses / period as f64;
    let first_rs = if avg_loss == 0.0 {
        100.0
    } else {
        avg_gain / avg_loss
    };
    let mut result = vec![IndicatorValue {
        time: data[period].time,
        value: 100.0 - (100.0 / (1.0 + first_rs)),
    }];
    for i in period + 1..data.len() {
        let change = data[i].close - data[i - 1].close;
        let gain = if change > 0.0 { change } else { 0.0 };
        let loss = if change < 0.0 { change.abs() } else { 0.0 };
        avg_gain = (avg_gain * (period as f64 - 1.0) + gain) / period as f64;
        avg_loss = (avg_loss * (period as f64 - 1.0) + loss) / period as f64;
        let rs = if avg_loss == 0.0 {
            100.0
        } else {
            avg_gain / avg_loss
        };
        result.push(IndicatorValue {
            time: data[i].time,
            value: 100.0 - (100.0 / (1.0 + rs)),
        });
    }
    out(result)
}

#[wasm_bindgen]
pub fn calculate_bollinger_bands(
    data: JsValue,
    period: u32,
    std_dev: f64,
) -> Result<JsValue, JsValue> {
    let data = candles_from(data)?;
    let period = period as usize;
    validate(&data, period)?;
    if period == 0 {
        return out(Vec::<BollingerBandsValue>::new());
    }
    let mut result = Vec::new();
    for i in period - 1..data.len() {
        let slice = &data[i + 1 - period..=i];
        let mean: f64 = slice.iter().map(|c| c.close).sum::<f64>() / period as f64;
        let variance: f64 =
            slice.iter().map(|c| (c.close - mean).powi(2)).sum::<f64>() / period as f64;
        let sd = variance.sqrt();
        result.push(BollingerBandsValue {
            time: data[i].time,
            middle: mean,
            upper: mean + sd * std_dev,
            lower: mean - sd * std_dev,
        });
    }
    out(result)
}

#[wasm_bindgen]
pub fn calculate_macd(
    data: JsValue,
    fast_period: u32,
    slow_period: u32,
    signal_period: u32,
) -> Result<JsValue, JsValue> {
    let data = candles_from(data)?;
    let (fast, slow, signal) = (
        fast_period as usize,
        slow_period as usize,
        signal_period as usize,
    );
    validate(&data, slow + signal)?;
    if fast == 0 || slow == 0 || signal == 0 {
        return out(Vec::<MacdValue>::new());
    }
    let closes: Vec<f64> = data.iter().map(|c| c.close).collect();
    let fast_ema = ema_values(&closes, fast);
    let slow_ema = ema_values(&closes, slow);
    let mut macd_line: Vec<Option<f64>> = Vec::with_capacity(closes.len());
    for i in 0..closes.len() {
        if i >= slow - 1 {
            macd_line.push(Some(fast_ema[i] - slow_ema[i]));
        } else {
            macd_line.push(None);
        }
    }
    let valid_macd: Vec<f64> = macd_line.iter().flatten().copied().collect();
    let signal_line = ema_values(&valid_macd, signal);
    let mut result = Vec::new();
    let mut signal_index = 0usize;
    for i in 0..data.len() {
        if i >= slow - 1 + signal - 1 && signal_index < signal_line.len() {
            if let Some(macd) = macd_line[i] {
                let sig = signal_line[signal_index];
                result.push(MacdValue {
                    time: data[i].time,
                    macd,
                    signal: sig,
                    histogram: macd - sig,
                });
                signal_index += 1;
            }
        }
    }
    out(result)
}

#[wasm_bindgen]
pub fn calculate_atr(data: JsValue, period: u32) -> Result<JsValue, JsValue> {
    let data = candles_from(data)?;
    let period = period as usize;
    validate(&data, period + 1)?;
    let mut tr_values = Vec::with_capacity(data.len() - 1);
    for i in 1..data.len() {
        let high = data[i].high;
        let low = data[i].low;
        let prev_close = data[i - 1].close;
        tr_values.push(
            (high - low)
                .max((high - prev_close).abs())
                .max((low - prev_close).abs()),
        );
    }
    let mut atr: f64 = tr_values[..period].iter().sum::<f64>() / period as f64;
    let mut result = vec![IndicatorValue {
        time: data[period].time,
        value: atr,
    }];
    for i in period..tr_values.len() {
        atr = (atr * (period as f64 - 1.0) + tr_values[i]) / period as f64;
        result.push(IndicatorValue {
            time: data[i + 1].time,
            value: atr,
        });
    }
    out(result)
}

#[wasm_bindgen]
pub fn calculate_ofi(data: JsValue) -> Result<JsValue, JsValue> {
    let trades: Vec<TradeInput> =
        serde_wasm_bindgen::from_value(data).map_err(|e| js_err(&e.to_string()))?;
    if trades.is_empty() {
        return serde_wasm_bindgen::to_value(&OfiResult {
            buy_volume: 0.0,
            sell_volume: 0.0,
            net_volume: 0.0,
            imbalance_ratio: 0.0,
        })
        .map_err(|e| js_err(&e.to_string()));
    }
    let mut buy_volume = 0.0f64;
    let mut sell_volume = 0.0f64;
    for trade in &trades {
        let qty = match &trade.quantity {
            serde_json::Value::Number(n) => n.as_f64().unwrap_or(f64::NAN),
            serde_json::Value::String(s) => s.parse::<f64>().unwrap_or(f64::NAN),
            _ => f64::NAN,
        };
        if !qty.is_finite() {
            continue;
        }
        if trade.is_buyer_maker {
            sell_volume += qty;
        } else {
            buy_volume += qty;
        }
    }
    let net_volume = buy_volume - sell_volume;
    let total_volume = buy_volume + sell_volume;
    let imbalance_ratio = if total_volume == 0.0 {
        0.0
    } else {
        net_volume / total_volume
    };
    serde_wasm_bindgen::to_value(&OfiResult {
        buy_volume,
        sell_volume,
        net_volume,
        imbalance_ratio,
    })
    .map_err(|e| js_err(&e.to_string()))
}

#[wasm_bindgen]
pub fn calculate_obv(data: JsValue) -> Result<JsValue, JsValue> {
    let data = candles_from(data)?;
    validate(&data, 1)?;
    let mut obv = 0.0f64;
    let mut result = vec![IndicatorValue {
        time: data[0].time,
        value: obv,
    }];
    for i in 1..data.len() {
        let close = data[i].close;
        let prev_close = data[i - 1].close;
        if close > prev_close {
            obv += data[i].volume;
        } else if close < prev_close {
            obv -= data[i].volume;
        }
        result.push(IndicatorValue {
            time: data[i].time,
            value: obv,
        });
    }
    out(result)
}

#[wasm_bindgen]
pub fn calculate_adx(data: JsValue, period: u32) -> Result<JsValue, JsValue> {
    let data = candles_from(data)?;
    let period = period as usize;
    validate(&data, period * 2)?;
    let mut tr_values = Vec::with_capacity(data.len() - 1);
    let mut dm_plus_values = Vec::with_capacity(data.len() - 1);
    let mut dm_minus_values = Vec::with_capacity(data.len() - 1);
    for i in 1..data.len() {
        let high = data[i].high;
        let low = data[i].low;
        let prev_close = data[i - 1].close;
        let prev_high = data[i - 1].high;
        let prev_low = data[i - 1].low;
        let tr = (high - low)
            .max((high - prev_close).abs())
            .max((low - prev_close).abs());
        let up_move = high - prev_high;
        let down_move = prev_low - low;
        let mut dm_plus = 0.0f64;
        let mut dm_minus = 0.0f64;
        if up_move > down_move && up_move > 0.0 {
            dm_plus = up_move;
        }
        if down_move > up_move && down_move > 0.0 {
            dm_minus = down_move;
        }
        tr_values.push(tr);
        dm_plus_values.push(dm_plus);
        dm_minus_values.push(dm_minus);
    }
    let mut smooth_tr: f64 = tr_values[..period].iter().sum();
    let mut smooth_dm_plus: f64 = dm_plus_values[..period].iter().sum();
    let mut smooth_dm_minus: f64 = dm_minus_values[..period].iter().sum();
    let mut dx_values = Vec::new();
    for i in period..tr_values.len() {
        smooth_tr = smooth_tr - smooth_tr / period as f64 + tr_values[i];
        smooth_dm_plus = smooth_dm_plus - smooth_dm_plus / period as f64 + dm_plus_values[i];
        smooth_dm_minus = smooth_dm_minus - smooth_dm_minus / period as f64 + dm_minus_values[i];
        let di_plus = (smooth_dm_plus / smooth_tr) * 100.0;
        let di_minus = (smooth_dm_minus / smooth_tr) * 100.0;
        dx_values.push((di_plus - di_minus).abs() / (di_plus + di_minus) * 100.0);
    }
    let mut result = Vec::new();
    if dx_values.len() >= period {
        let mut adx: f64 = dx_values[..period].iter().sum::<f64>() / period as f64;
        result.push(IndicatorValue {
            time: data[2 * period].time,
            value: adx,
        });
        for i in period..dx_values.len() {
            adx = (adx * (period as f64 - 1.0) + dx_values[i]) / period as f64;
            result.push(IndicatorValue {
                time: data[period + 1 + i].time,
                value: adx,
            });
        }
    }
    out(result)
}

#[wasm_bindgen]
pub fn calculate_hurst(data: JsValue) -> Result<JsValue, JsValue> {
    let data = candles_from(data)?;
    if data.len() < 100 {
        return Ok(JsValue::from_f64(0.5));
    }
    let closes: Vec<f64> = data.iter().map(|c| c.close).collect();
    let n = closes.len();
    let returns: Vec<f64> = (1..n).map(|i| (closes[i] / closes[i - 1]).ln()).collect();
    let mean: f64 = returns.iter().sum::<f64>() / returns.len() as f64;
    let deviations: Vec<f64> = returns.iter().map(|r| r - mean).collect();
    let mut cumulative = Vec::with_capacity(deviations.len());
    let mut sum = 0.0f64;
    for d in &deviations {
        sum += d;
        cumulative.push(sum);
    }
    let r = cumulative.iter().fold(f64::NEG_INFINITY, |a, &b| a.max(b))
        - cumulative.iter().fold(f64::INFINITY, |a, &b| a.min(b));
    let variance: f64 = deviations.iter().map(|d| d * d).sum::<f64>() / deviations.len() as f64;
    let s = variance.sqrt();
    if s == 0.0 {
        return Ok(JsValue::from_f64(0.5));
    }
    let rs = r / s;
    Ok(JsValue::from_f64(rs.ln() / (n as f64).ln()))
}

// ===== Microstructure: trade classification, VPIN, book OFI, heatmap =====

/// Mimics JavaScript `parseFloat`: leading whitespace, optional sign,
/// longest valid numeric prefix, "Infinity" support, NaN on failure.
fn js_parse_float(s: &str) -> f64 {
    let t = s.trim_start();
    if t.is_empty() {
        return f64::NAN;
    }
    let lower = t.to_ascii_lowercase();
    if lower.starts_with("infinity") {
        return f64::INFINITY;
    }
    if lower.starts_with("-infinity") {
        return f64::NEG_INFINITY;
    }
    let mut end = 0usize;
    for (i, c) in t.char_indices() {
        if c.is_ascii_digit() || matches!(c, '+' | '-' | '.' | 'e' | 'E') {
            end = i + c.len_utf8();
        } else {
            break;
        }
    }
    let prefix = &t[..end];
    let bytes = prefix.as_bytes();
    for cut in (0..=bytes.len()).rev() {
        // char boundary safe: prefix is ASCII-only
        if let Ok(v) = prefix[..cut].parse::<f64>() {
            return v;
        }
    }
    f64::NAN
}

fn js_value_to_serde(v: JsValue) -> Result<serde_json::Value, JsValue> {
    serde_wasm_bindgen::from_value(v).map_err(|e| js_err(&e.to_string()))
}

fn serde_to_js<T: serde::Serialize>(v: &T) -> Result<JsValue, JsValue> {
    serde_wasm_bindgen::to_value(v).map_err(|e| js_err(&e.to_string()))
}

// serde_json::json!({...}) literal -> plain JS object (no Map wrapping).
fn json_out(v: serde_json::Value) -> Result<JsValue, JsValue> {
    Ok(value_to_js(&v))
}

// serde_json::Value serializes through serde maps, which serde-wasm-bindgen
// turns into JS Maps. JS callers expect plain objects, so walk the value and
// build js_sys objects/arrays directly.
fn value_to_js(v: &serde_json::Value) -> JsValue {
    match v {
        serde_json::Value::Null => JsValue::NULL,
        serde_json::Value::Bool(b) => JsValue::from_bool(*b),
        serde_json::Value::Number(n) => n.as_f64().map(JsValue::from_f64).unwrap_or(JsValue::NULL),
        serde_json::Value::String(s) => JsValue::from_str(s),
        serde_json::Value::Array(arr) => {
            let js_arr = js_sys::Array::new();
            for item in arr {
                js_arr.push(&value_to_js(item));
            }
            js_arr.into()
        }
        serde_json::Value::Object(map) => {
            let obj = js_sys::Object::new();
            for (k, val) in map {
                let _ = js_sys::Reflect::set(&obj, &JsValue::from_str(k), &value_to_js(val));
            }
            obj.into()
        }
    }
}

fn values_to_js(items: &[serde_json::Value]) -> JsValue {
    let js_arr = js_sys::Array::new();
    for item in items {
        js_arr.push(&value_to_js(item));
    }
    js_arr.into()
}

fn field_f64(obj: &serde_json::Value, key: &str) -> Option<f64> {
    obj.get(key).and_then(|x| match x {
        serde_json::Value::Number(n) => n.as_f64(),
        serde_json::Value::String(s) => Some(js_parse_float(s)),
        _ => None,
    })
}

fn field_bool(obj: &serde_json::Value, key: &str) -> Option<bool> {
    obj.get(key).and_then(|x| x.as_bool())
}

fn field_str<'a>(obj: &'a serde_json::Value, key: &str) -> Option<&'a str> {
    obj.get(key).and_then(|x| x.as_str())
}

fn now_ms() -> f64 {
    js_sys::Date::now()
}

// ----- TradeClassifier -----

#[wasm_bindgen]
pub struct TradeClassifierCore {
    previous_price: Option<f64>,
    previous_mid_price: Option<f64>,
    classified_trades: VecDeque<serde_json::Value>,
}

impl Default for TradeClassifierCore {
    fn default() -> Self {
        Self::new()
    }
}

#[wasm_bindgen]
impl TradeClassifierCore {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            previous_price: None,
            previous_mid_price: None,
            classified_trades: VecDeque::new(),
        }
    }

    fn push_history(&mut self, trade: serde_json::Value) {
        self.classified_trades.push_back(trade);
        if self.classified_trades.len() > 10_000 {
            self.classified_trades.pop_front();
        }
    }

    fn last_side(&self) -> Option<&str> {
        self.classified_trades
            .back()
            .and_then(|t| field_str(t, "side"))
    }

    #[wasm_bindgen(js_name = classifyByTickRule)]
    pub fn classify_by_tick_rule(&mut self, trade: JsValue) -> Result<JsValue, JsValue> {
        let mut obj = js_value_to_serde(trade)?;
        let price = field_f64(&obj, "price").unwrap_or(f64::NAN);
        let buyer_maker = field_bool(&obj, "isBuyerMaker").unwrap_or(false);
        let side_owned: String = match self.previous_price {
            None => {
                if buyer_maker {
                    "sell".into()
                } else {
                    "buy".into()
                }
            }
            Some(prev) if price > prev => "buy".into(),
            Some(prev) if price < prev => "sell".into(),
            _ => self.last_side().map(str::to_string).unwrap_or_else(|| {
                if buyer_maker {
                    "sell".into()
                } else {
                    "buy".into()
                }
            }),
        };
        self.previous_price = Some(price);
        if let serde_json::Value::Object(map) = &mut obj {
            map.insert("side".into(), serde_json::Value::String(side_owned));
            map.insert(
                "classificationMethod".into(),
                serde_json::Value::String("tick".into()),
            );
        }
        self.push_history(obj.clone());
        Ok(value_to_js(&obj))
    }

    #[wasm_bindgen(js_name = classifyFromExchange)]
    pub fn classify_from_exchange(&mut self, trade: JsValue) -> Result<JsValue, JsValue> {
        let mut obj = js_value_to_serde(trade)?;
        let price = field_f64(&obj, "price").unwrap_or(f64::NAN);
        let buyer_maker = field_bool(&obj, "isBuyerMaker").unwrap_or(false);
        self.previous_price = Some(price);
        if let serde_json::Value::Object(map) = &mut obj {
            map.insert(
                "side".into(),
                serde_json::Value::String(if buyer_maker {
                    "sell".into()
                } else {
                    "buy".into()
                }),
            );
            map.insert(
                "classificationMethod".into(),
                serde_json::Value::String("exchange".into()),
            );
        }
        self.push_history(obj.clone());
        Ok(value_to_js(&obj))
    }

    #[wasm_bindgen(js_name = classifyByLeeReady)]
    pub fn classify_by_lee_ready(
        &mut self,
        trade: JsValue,
        current_mid_price: f64,
    ) -> Result<JsValue, JsValue> {
        let mut obj = js_value_to_serde(trade)?;
        let price = field_f64(&obj, "price").unwrap_or(f64::NAN);
        let buyer_maker = field_bool(&obj, "isBuyerMaker").unwrap_or(false);
        let fallback = || {
            if buyer_maker {
                "sell".to_string()
            } else {
                "buy".to_string()
            }
        };
        let side: String = if price > current_mid_price {
            "buy".into()
        } else if price < current_mid_price {
            "sell".into()
        } else {
            match self.previous_mid_price {
                Some(prev_mid) if price > prev_mid => "buy".into(),
                Some(prev_mid) if price < prev_mid => "sell".into(),
                _ => fallback(),
            }
        };
        self.previous_mid_price = Some(current_mid_price);
        self.previous_price = Some(price);
        if let serde_json::Value::Object(map) = &mut obj {
            map.insert("side".into(), serde_json::Value::String(side));
            map.insert(
                "classificationMethod".into(),
                serde_json::Value::String("quote".into()),
            );
        }
        self.push_history(obj.clone());
        Ok(value_to_js(&obj))
    }

    #[wasm_bindgen(js_name = calculateVolumeDelta)]
    pub fn calculate_volume_delta(&self, window_ms: f64) -> JsValue {
        let cutoff = now_ms() - window_ms;
        let mut buy = 0.0f64;
        let mut sell = 0.0f64;
        for t in &self.classified_trades {
            let ts = field_f64(t, "timestamp").unwrap_or(f64::NAN);
            if ts >= cutoff {
                let qty = field_f64(t, "quantity").unwrap_or(0.0);
                match field_str(t, "side") {
                    Some("buy") => buy += qty,
                    _ => sell += qty,
                }
            }
        }
        let total = buy + sell;
        let delta = buy - sell;
        let out = serde_json::json!({
            "buyVolume": buy,
            "sellVolume": sell,
            "delta": delta,
            "deltaPercent": if total > 0.0 { delta / total * 100.0 } else { 0.0 },
            "timestamp": now_ms(),
        });
        value_to_js(&out)
    }

    #[wasm_bindgen(js_name = getCumulativeVolumeDelta)]
    pub fn get_cumulative_volume_delta(&self, interval_ms: f64) -> JsValue {
        let mut result: Vec<serde_json::Value> = Vec::new();
        let Some(first) = self.classified_trades.front() else {
            return values_to_js(&result);
        };
        let start = field_f64(first, "timestamp").unwrap_or(0.0);
        let mut cvd = 0.0f64;
        let mut current_bucket = (start / interval_ms).floor() * interval_ms;
        for trade in &self.classified_trades {
            let ts = field_f64(trade, "timestamp").unwrap_or(f64::NAN);
            let trade_bucket = (ts / interval_ms).floor() * interval_ms;
            if trade_bucket > current_bucket {
                result.push(serde_json::json!({"timestamp": current_bucket, "cvd": cvd}));
                current_bucket = trade_bucket;
            }
            let qty = field_f64(trade, "quantity").unwrap_or(0.0);
            if field_str(trade, "side") == Some("buy") {
                cvd += qty;
            } else {
                cvd -= qty;
            }
        }
        result.push(serde_json::json!({"timestamp": current_bucket, "cvd": cvd}));
        values_to_js(&result)
    }

    #[wasm_bindgen(js_name = detectDivergence)]
    pub fn detect_divergence(&self, price_data: JsValue) -> JsValue {
        let null_result = || serde_json::json!({"type": null, "strength": 0.0});
        let cvd_data = self.get_cumulative_volume_delta(60_000.0);
        let cvd_arr: Vec<serde_json::Value> =
            serde_wasm_bindgen::from_value(cvd_data).unwrap_or_default();
        let price_arr: Vec<serde_json::Value> = js_value_to_serde(price_data)
            .map(|v| v.as_array().cloned().unwrap_or_default())
            .unwrap_or_default();
        if cvd_arr.len() < 2 || price_arr.len() < 2 {
            return value_to_js(&null_result());
        }
        let lookback = 10usize.min(cvd_arr.len()).min(price_arr.len());
        let recent_cvd = &cvd_arr[cvd_arr.len() - lookback..];
        let recent_price = &price_arr[price_arr.len() - lookback..];
        if recent_cvd.len() < 2 || recent_price.len() < 2 {
            return value_to_js(&null_result());
        }
        let last_cvd = field_f64(recent_cvd.last().unwrap(), "cvd").unwrap_or(0.0);
        let first_cvd = field_f64(&recent_cvd[0], "cvd").unwrap_or(0.0);
        let last_price = field_f64(recent_price.last().unwrap(), "price").unwrap_or(0.0);
        let first_price = field_f64(&recent_price[0], "price").unwrap_or(0.0);
        let cvd_trend = last_cvd - first_cvd;
        let price_trend = last_price - first_price;
        // JS: firstCVD.cvd || 1 — falsy covers 0 and NaN
        let denom = if first_cvd == 0.0 || first_cvd.is_nan() {
            1.0
        } else {
            first_cvd.abs()
        };
        let cvd_norm = cvd_trend / denom;
        let price_norm = price_trend / first_price;
        let threshold = 0.01;
        let out = if price_norm < -threshold && cvd_norm > threshold {
            serde_json::json!({"type": "bullish", "strength": (cvd_norm - price_norm).abs()})
        } else if price_norm > threshold && cvd_norm < -threshold {
            serde_json::json!({"type": "bearish", "strength": (cvd_norm - price_norm).abs()})
        } else {
            null_result()
        };
        value_to_js(&out)
    }

    #[wasm_bindgen(js_name = getBuySellRatio)]
    pub fn get_buy_sell_ratio(&self, window_ms: f64) -> f64 {
        let cutoff = now_ms() - window_ms;
        let mut buy = 0.0f64;
        let mut sell = 0.0f64;
        for t in &self.classified_trades {
            let ts = field_f64(t, "timestamp").unwrap_or(f64::NAN);
            if ts >= cutoff {
                let qty = field_f64(t, "quantity").unwrap_or(0.0);
                if field_str(t, "side") == Some("buy") {
                    buy += qty;
                } else {
                    sell += qty;
                }
            }
        }
        if sell > 0.0 {
            buy / sell
        } else {
            0.0
        }
    }

    #[wasm_bindgen(js_name = getHistory)]
    pub fn get_history(&self, count: u32) -> JsValue {
        let skip = self.classified_trades.len().saturating_sub(count as usize);
        let items: Vec<serde_json::Value> =
            self.classified_trades.iter().skip(skip).cloned().collect();
        values_to_js(&items)
    }

    pub fn reset(&mut self) {
        self.previous_price = None;
        self.previous_mid_price = None;
        self.classified_trades.clear();
    }
}

// ----- VPINCalculator -----

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct VpinBucketOut {
    bucket_number: u32,
    buy_volume: f64,
    sell_volume: f64,
    total_volume: f64,
    imbalance: f64,
    timestamp: f64,
}

#[derive(Clone)]
struct VpinBucket {
    bucket_number: u32,
    buy_volume: f64,
    sell_volume: f64,
    total_volume: f64,
    imbalance: f64,
    timestamp: f64,
}

impl VpinBucket {
    fn new(number: u32) -> Self {
        Self {
            bucket_number: number,
            buy_volume: 0.0,
            sell_volume: 0.0,
            total_volume: 0.0,
            imbalance: 0.0,
            timestamp: now_ms(),
        }
    }
    fn to_out(&self) -> VpinBucketOut {
        VpinBucketOut {
            bucket_number: self.bucket_number,
            buy_volume: self.buy_volume,
            sell_volume: self.sell_volume,
            total_volume: self.total_volume,
            imbalance: self.imbalance,
            timestamp: self.timestamp,
        }
    }
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct VpinResultOut {
    vpin: f64,
    toxicity: &'static str,
    buckets_filled: usize,
    current_bucket: VpinBucketOut,
    timestamp: f64,
}

#[wasm_bindgen]
pub struct VpinCalculatorCore {
    buckets: VecDeque<VpinBucket>,
    current_bucket: VpinBucket,
    bucket_number: u32,
    bucket_size: f64,
    num_buckets: usize,
}

#[wasm_bindgen]
impl VpinCalculatorCore {
    #[wasm_bindgen(constructor)]
    pub fn new(bucket_size: f64, num_buckets: u32) -> Self {
        Self {
            buckets: VecDeque::new(),
            current_bucket: VpinBucket::new(0),
            bucket_number: 0,
            bucket_size,
            num_buckets: num_buckets as usize,
        }
    }

    fn vpin_value(&self) -> f64 {
        let n = self.num_buckets.min(self.buckets.len());
        if n == 0 {
            return 0.0;
        }
        let skip = self.buckets.len() - n;
        let mut sum_imbalance = 0.0f64;
        let mut sum_volume = 0.0f64;
        for b in self.buckets.iter().skip(skip) {
            sum_imbalance += b.imbalance;
            sum_volume += b.total_volume;
        }
        if sum_volume > 0.0 {
            sum_imbalance / sum_volume
        } else {
            0.0
        }
    }

    fn toxicity_of(vpin: f64) -> &'static str {
        if vpin < 0.3 {
            "low"
        } else if vpin < 0.5 {
            "medium"
        } else if vpin < 0.7 {
            "high"
        } else {
            "extreme"
        }
    }

    fn result_now(&self) -> VpinResultOut {
        let vpin = self.vpin_value();
        VpinResultOut {
            vpin,
            toxicity: Self::toxicity_of(vpin),
            buckets_filled: self.buckets.len(),
            current_bucket: self.current_bucket.to_out(),
            timestamp: now_ms(),
        }
    }

    #[wasm_bindgen(js_name = addTrade)]
    pub fn add_trade(&mut self, trade: JsValue) -> Result<JsValue, JsValue> {
        let obj = js_value_to_serde(trade)?;
        let side = field_str(&obj, "side").unwrap_or("");
        let quantity = field_f64(&obj, "quantity").unwrap_or(f64::NAN);
        let timestamp = field_f64(&obj, "timestamp").unwrap_or(now_ms());
        if self.bucket_size.partial_cmp(&0.0) != Some(std::cmp::Ordering::Greater)
            || !quantity.is_finite()
            || quantity.partial_cmp(&0.0) != Some(std::cmp::Ordering::Greater)
        {
            return Ok(JsValue::NULL);
        }
        let is_buy = side == "buy";
        let mut remaining = quantity;
        let mut latest: Option<VpinResultOut> = None;
        while remaining > 0.0 {
            let capacity = self.bucket_size - self.current_bucket.total_volume;
            let allocated = remaining.min(capacity);
            self.current_bucket.total_volume += allocated;
            if is_buy {
                self.current_bucket.buy_volume += allocated;
            } else {
                self.current_bucket.sell_volume += allocated;
            }
            self.current_bucket.timestamp = timestamp;
            remaining -= allocated;
            if self.current_bucket.total_volume >= self.bucket_size {
                self.current_bucket.imbalance =
                    (self.current_bucket.buy_volume - self.current_bucket.sell_volume).abs();
                self.buckets.push_back(self.current_bucket.clone());
                if self.buckets.len() > 1000 {
                    self.buckets.pop_front();
                }
                self.bucket_number += 1;
                self.current_bucket = VpinBucket::new(self.bucket_number);
                if self.buckets.len() >= self.num_buckets {
                    latest = Some(self.result_now());
                }
            }
        }
        match latest {
            Some(r) => serde_to_js(&r),
            None => Ok(JsValue::NULL),
        }
    }

    #[wasm_bindgen(js_name = getVPINHistory)]
    pub fn get_vpin_history(&self, count: u32) -> JsValue {
        let mut result: Vec<serde_json::Value> = Vec::new();
        if self.buckets.len() < self.num_buckets || self.num_buckets == 0 {
            return values_to_js(&result);
        }
        for i in self.num_buckets..=self.buckets.len() {
            let slice: Vec<&VpinBucket> = self
                .buckets
                .iter()
                .skip(i - self.num_buckets)
                .take(self.num_buckets)
                .collect();
            let sum_imbalance: f64 = slice.iter().map(|b| b.imbalance).sum();
            let sum_volume: f64 = slice.iter().map(|b| b.total_volume).sum();
            let vpin = if sum_volume > 0.0 {
                sum_imbalance / sum_volume
            } else {
                0.0
            };
            if let Some(last) = slice.last() {
                result.push(serde_json::json!({"timestamp": last.timestamp, "vpin": vpin}));
            }
        }
        let skip = result.len().saturating_sub(count as usize);
        let items: Vec<serde_json::Value> = result.into_iter().skip(skip).collect();
        values_to_js(&items)
    }

    #[wasm_bindgen(js_name = detectSpike)]
    pub fn detect_spike(&self, threshold: f64) -> bool {
        if self.buckets.len() < self.num_buckets {
            return false;
        }
        self.vpin_value() > threshold
    }

    #[wasm_bindgen(js_name = getVPINTrend)]
    pub fn get_vpin_trend(&self, lookback: u32) -> JsValue {
        let lookback = lookback as usize;
        let history = self.get_vpin_history((lookback * 2) as u32);
        let hist: Vec<serde_json::Value> =
            serde_wasm_bindgen::from_value(history).unwrap_or_default();
        if hist.len() < lookback * 2 {
            return JsValue::from_str("stable");
        }
        let recent: Vec<f64> = hist[hist.len() - lookback..]
            .iter()
            .filter_map(|h| h.get("vpin").and_then(|v| v.as_f64()))
            .collect();
        let older: Vec<f64> = hist[hist.len() - lookback * 2..hist.len() - lookback]
            .iter()
            .filter_map(|h| h.get("vpin").and_then(|v| v.as_f64()))
            .collect();
        if recent.is_empty() || older.is_empty() {
            return JsValue::from_str("stable");
        }
        let recent_avg = recent.iter().sum::<f64>() / recent.len() as f64;
        let older_avg = older.iter().sum::<f64>() / older.len() as f64;
        let change = recent_avg - older_avg;
        if change > 0.05 {
            JsValue::from_str("increasing")
        } else if change < -0.05 {
            JsValue::from_str("decreasing")
        } else {
            JsValue::from_str("stable")
        }
    }

    #[wasm_bindgen(js_name = getCurrentBucketProgress)]
    pub fn get_current_bucket_progress(&self) -> f64 {
        (self.current_bucket.total_volume / self.bucket_size) * 100.0
    }

    pub fn reset(&mut self) {
        self.buckets.clear();
        self.bucket_number = 0;
        self.current_bucket = VpinBucket::new(0);
    }
}

// ----- OFICalculator (order-book depth snapshots) -----

#[derive(serde::Deserialize)]
struct BookSnapshot {
    bids: Vec<(String, String)>,
    asks: Vec<(String, String)>,
    timestamp: f64,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DepthOfiResult {
    ofi: f64,
    bid_pressure: f64,
    ask_pressure: f64,
    total_volume: f64,
    timestamp: f64,
}

fn book_pressure(previous: &[(String, String)], current: &[(String, String)]) -> f64 {
    // Mirrors JS Map semantics: first insertion fixes position, later
    // duplicates overwrite the value. Iteration order drives FP summation.
    fn ordered_map(levels: &[(String, String)]) -> (Vec<String>, HashMap<String, f64>) {
        let mut order: Vec<String> = Vec::with_capacity(levels.len());
        let mut map: HashMap<String, f64> = HashMap::with_capacity(levels.len());
        for (price, qty) in levels {
            if !map.contains_key(price) {
                order.push(price.clone());
            }
            map.insert(price.clone(), js_parse_float(qty));
        }
        (order, map)
    }
    let (prev_order, prev_map) = ordered_map(previous);
    let (curr_order, curr_map) = ordered_map(current);
    let mut pressure = 0.0f64;
    for price in prev_order
        .iter()
        .chain(curr_order.iter().filter(|p| !prev_map.contains_key(*p)))
    {
        let c = curr_map.get(price).copied().unwrap_or(0.0);
        let p = prev_map.get(price).copied().unwrap_or(0.0);
        pressure += c - p;
    }
    pressure
}

#[wasm_bindgen]
pub struct OfiBookCalculator {
    previous_snapshot: Option<BookSnapshot>,
    ofi_history: VecDeque<DepthOfiResult>,
}

impl Default for OfiBookCalculator {
    fn default() -> Self {
        Self::new()
    }
}

#[wasm_bindgen]
impl OfiBookCalculator {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            previous_snapshot: None,
            ofi_history: VecDeque::new(),
        }
    }

    #[wasm_bindgen(js_name = calculate)]
    pub fn calculate(&mut self, snapshot: JsValue) -> Result<JsValue, JsValue> {
        let current: BookSnapshot =
            serde_wasm_bindgen::from_value(snapshot).map_err(|e| js_err(&e.to_string()))?;
        let Some(prev) = self.previous_snapshot.take() else {
            self.previous_snapshot = Some(current);
            return Ok(JsValue::NULL);
        };
        let bid_pressure = book_pressure(&prev.bids, &current.bids);
        let ask_pressure = book_pressure(&prev.asks, &current.asks);
        let total_volume = bid_pressure.abs() + ask_pressure.abs();
        let ofi = if total_volume > 0.0 {
            (bid_pressure - ask_pressure) / total_volume
        } else {
            0.0
        };
        let result = DepthOfiResult {
            ofi,
            bid_pressure,
            ask_pressure,
            total_volume,
            timestamp: current.timestamp,
        };
        self.ofi_history.push_back(DepthOfiResult {
            ofi: result.ofi,
            bid_pressure: result.bid_pressure,
            ask_pressure: result.ask_pressure,
            total_volume: result.total_volume,
            timestamp: result.timestamp,
        });
        if self.ofi_history.len() > 1000 {
            self.ofi_history.pop_front();
        }
        self.previous_snapshot = Some(current);
        serde_to_js(&result)
    }

    #[wasm_bindgen(js_name = getOFIMovingAverage)]
    pub fn get_ofi_moving_average(&self, window_size: u32) -> f64 {
        if self.ofi_history.is_empty() {
            return 0.0;
        }
        let skip = self.ofi_history.len().saturating_sub(window_size as usize);
        let window: Vec<f64> = self.ofi_history.iter().skip(skip).map(|r| r.ofi).collect();
        window.iter().sum::<f64>() / window.len() as f64
    }

    #[wasm_bindgen(js_name = getOFIStdDev)]
    pub fn get_ofi_std_dev(&self, window_size: u32) -> f64 {
        if self.ofi_history.len() < 2 {
            return 0.0;
        }
        let skip = self.ofi_history.len().saturating_sub(window_size as usize);
        let window: Vec<f64> = self.ofi_history.iter().skip(skip).map(|r| r.ofi).collect();
        if window.is_empty() {
            return 0.0;
        }
        let mean = window.iter().sum::<f64>() / window.len() as f64;
        let variance = window.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / window.len() as f64;
        variance.sqrt()
    }

    #[wasm_bindgen(js_name = detectSignificantEvent)]
    pub fn detect_significant_event(&self) -> JsValue {
        let null_ev = || serde_json::json!({"type": null, "magnitude": 0.0});
        if self.ofi_history.len() < 10 {
            return value_to_js(&null_ev());
        }
        let latest = self.ofi_history.back().unwrap();
        let mean = self.get_ofi_moving_average(10);
        let std_dev = self.get_ofi_std_dev(10);
        if std_dev == 0.0 {
            return value_to_js(&null_ev());
        }
        let z = (latest.ofi - mean) / std_dev;
        let out = if z > 2.0 {
            serde_json::json!({"type": "buy", "magnitude": z})
        } else if z < -2.0 {
            serde_json::json!({"type": "sell", "magnitude": z.abs()})
        } else {
            null_ev()
        };
        value_to_js(&out)
    }

    #[wasm_bindgen(js_name = getHistory)]
    pub fn get_history(&self, count: u32) -> JsValue {
        let skip = self.ofi_history.len().saturating_sub(count as usize);
        let items: Vec<DepthOfiResult> = self
            .ofi_history
            .iter()
            .skip(skip)
            .map(|r| DepthOfiResult {
                ofi: r.ofi,
                bid_pressure: r.bid_pressure,
                ask_pressure: r.ask_pressure,
                total_volume: r.total_volume,
                timestamp: r.timestamp,
            })
            .collect();
        serde_to_js(&items).unwrap_or(JsValue::NULL)
    }

    pub fn reset(&mut self) {
        self.previous_snapshot = None;
        self.ofi_history.clear();
    }
}

// ----- Heatmap aggregation -----

#[derive(serde::Deserialize)]
struct HeatmapSnapshotIn {
    timestamp: f64,
    bids: Vec<(f64, f64)>,
    asks: Vec<(f64, f64)>,
}

#[derive(serde::Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct HeatmapConfigIn {
    time_bin_seconds: Option<f64>,
    price_bin_size: Option<f64>,
    time_window_minutes: Option<f64>,
    max_price_levels: Option<u32>,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct HeatmapCellOut {
    time: f64,
    price: f64,
    bid_size: f64,
    ask_size: f64,
    total_size: f64,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct HeatmapResultOut {
    cells: Vec<HeatmapCellOut>,
    time_extent: Option<[f64; 2]>,
    price_extent: Option<[f64; 2]>,
    max_bid_size: f64,
    max_ask_size: f64,
    is_empty: bool,
}

#[wasm_bindgen(js_name = aggregateOrderBookHeatmap)]
pub fn aggregate_order_book_heatmap(
    snapshots: JsValue,
    config: JsValue,
    now: f64,
) -> Result<JsValue, JsValue> {
    let cfg: HeatmapConfigIn =
        serde_wasm_bindgen::from_value(config).map_err(|e| js_err(&e.to_string()))?;
    let time_bin_seconds = cfg.time_bin_seconds.unwrap_or(10.0);
    let price_bin_size = cfg.price_bin_size.unwrap_or(0.5);
    let time_window_minutes = cfg.time_window_minutes.unwrap_or(15.0);
    let max_price_levels = cfg.max_price_levels;
    for (v, name) in [
        (time_bin_seconds, "timeBinSeconds"),
        (price_bin_size, "priceBinSize"),
        (time_window_minutes, "timeWindowMinutes"),
    ] {
        if !v.is_finite() || v <= 0.0 {
            return Err(js_err(&format!("{name} must be a positive finite number")));
        }
    }
    let snaps: Vec<HeatmapSnapshotIn> =
        serde_wasm_bindgen::from_value(snapshots).map_err(|e| js_err(&e.to_string()))?;
    let empty = || HeatmapResultOut {
        cells: Vec::new(),
        time_extent: None,
        price_extent: None,
        max_bid_size: 0.0,
        max_ask_size: 0.0,
        is_empty: true,
    };
    if snaps.is_empty() {
        return serde_to_js(&empty());
    }
    let start_time = now - time_window_minutes * 60_000.0;
    let time_bin_ms = time_bin_seconds * 1000.0;
    let relevant: Vec<&HeatmapSnapshotIn> =
        snaps.iter().filter(|s| s.timestamp >= start_time).collect();
    if relevant.is_empty() {
        return serde_to_js(&empty());
    }
    let mut cell_map: HashMap<(u64, u64), HeatmapCellOut> = HashMap::new();
    let mut min_price = f64::INFINITY;
    let mut max_price = f64::NEG_INFINITY;
    for snap in relevant {
        let time_bin = (snap.timestamp / time_bin_ms).floor() * time_bin_ms;
        let mut process = |levels: &[(f64, f64)], is_bid: bool| {
            for (index, (price, size)) in levels.iter().enumerate() {
                if !price.is_finite() || !size.is_finite() || *size <= 0.0 {
                    continue;
                }
                if let Some(max) = max_price_levels {
                    if index as u32 >= max {
                        continue;
                    }
                }
                let price_bin = (*price / price_bin_size).floor() * price_bin_size;
                let key = (
                    if time_bin == 0.0 { 0.0f64 } else { time_bin }.to_bits(),
                    if price_bin == 0.0 { 0.0f64 } else { price_bin }.to_bits(),
                );
                min_price = min_price.min(price_bin);
                max_price = max_price.max(price_bin);
                cell_map
                    .entry(key)
                    .and_modify(|c| {
                        if is_bid {
                            c.bid_size += size;
                        } else {
                            c.ask_size += size;
                        }
                        c.total_size += size;
                    })
                    .or_insert(HeatmapCellOut {
                        time: time_bin,
                        price: price_bin,
                        bid_size: if is_bid { *size } else { 0.0 },
                        ask_size: if is_bid { 0.0 } else { *size },
                        total_size: *size,
                    });
            }
        };
        process(&snap.bids, true);
        process(&snap.asks, false);
    }
    let mut cells: Vec<HeatmapCellOut> = cell_map.into_values().collect();
    cells.sort_by(|a, b| {
        a.time
            .partial_cmp(&b.time)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then(
                a.price
                    .partial_cmp(&b.price)
                    .unwrap_or(std::cmp::Ordering::Equal),
            )
    });
    let max_bid = cells.iter().map(|c| c.bid_size).fold(0.0, f64::max);
    let max_ask = cells.iter().map(|c| c.ask_size).fold(0.0, f64::max);
    let is_empty = cells.is_empty();
    let time_extent = cells.first().map(|c| [c.time, cells.last().unwrap().time]);
    let price_extent = if !is_empty && min_price.is_finite() && max_price.is_finite() {
        Some([min_price, max_price])
    } else {
        None
    };
    serde_to_js(&HeatmapResultOut {
        cells,
        time_extent,
        price_extent,
        max_bid_size: max_bid,
        max_ask_size: max_ask,
        is_empty,
    })
}

// ===== Binance payload parsers =====

/// JavaScript `Number(value)` coercion on a serde_json value.
/// Null -> 0, booleans -> 1/0, strings -> full-string parse (empty -> 0),
/// single-element arrays unwrap, everything else -> NaN.
fn js_to_number(v: &serde_json::Value) -> f64 {
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
        serde_json::Value::String(s) => js_number_string(s),
        serde_json::Value::Array(arr) => {
            if arr.is_empty() {
                0.0
            } else if arr.len() == 1 {
                js_to_number(&arr[0])
            } else {
                f64::NAN
            }
        }
        serde_json::Value::Object(_) => f64::NAN,
    }
}

/// JavaScript `Number(string)`: trims, empty -> 0, "Infinity" supported,
/// hex/binary/octal literals, strict full-string decimal parse.
fn js_number_string(s: &str) -> f64 {
    let t = s.trim();
    if t.is_empty() {
        return 0.0;
    }
    let lower = t.to_ascii_lowercase();
    let unsigned = lower.strip_prefix('+').unwrap_or(&lower);
    if unsigned == "infinity" {
        return if lower.starts_with('-') {
            f64::NEG_INFINITY
        } else {
            f64::INFINITY
        };
    }
    // Reject non-numeric words early: Rust's parser accepts "inf"/"nan"
    // variants that JavaScript's Number() rejects.
    let body = t
        .strip_prefix('-')
        .or_else(|| t.strip_prefix('+'))
        .unwrap_or(t);
    if body.starts_with(|c: char| c.is_ascii_alphabetic()) && !body.eq_ignore_ascii_case("infinity")
    {
        return f64::NAN;
    }
    // Hex / binary / octal integer literals: Number("0x10") === 16.
    let sign = if t.starts_with('-') { -1.0 } else { 1.0 };
    if let Some(hex) = body.strip_prefix("0x").or_else(|| body.strip_prefix("0X")) {
        if hex.is_empty() || !hex.chars().all(|c| c.is_ascii_hexdigit()) {
            return f64::NAN;
        }
        return u128::from_str_radix(hex, 16)
            .map(|v| v as f64 * sign)
            .unwrap_or(f64::INFINITY);
    }
    if let Some(bin) = body.strip_prefix("0b").or_else(|| body.strip_prefix("0B")) {
        if bin.is_empty() || !bin.chars().all(|c| c == '0' || c == '1') {
            return f64::NAN;
        }
        let v = bin.chars().fold(0.0f64, |acc, c| {
            acc * 2.0 + if c == '1' { 1.0 } else { 0.0 }
        });
        return v * sign;
    }
    if let Some(oct) = body.strip_prefix("0o").or_else(|| body.strip_prefix("0O")) {
        if oct.is_empty() || !oct.chars().all(|c| ('0'..='7').contains(&c)) {
            return f64::NAN;
        }
        return u128::from_str_radix(oct, 8)
            .map(|v| v as f64 * sign)
            .unwrap_or(f64::INFINITY);
    }
    t.parse::<f64>().unwrap_or(f64::NAN)
}

/// JavaScript `Math.max`: propagates NaN (unlike f64::max).
fn js_max(a: f64, b: f64) -> f64 {
    if a.is_nan() || b.is_nan() {
        f64::NAN
    } else if a == 0.0 && b == 0.0 {
        // Math.max(+0, -0) === +0
        0.0
    } else {
        a.max(b)
    }
}

/// JavaScript `Math.round`: halves toward +infinity.
fn js_round(x: f64) -> f64 {
    (x + 0.5).floor()
}

fn as_record(v: &serde_json::Value) -> Option<&serde_json::Map<String, serde_json::Value>> {
    v.as_object()
}

/// `value === null || value === undefined || value === ''` skip check used by
/// the liquidation/ticker fallbacks. serde maps JS undefined to Null.
fn is_nullish_or_empty(v: Option<&serde_json::Value>) -> bool {
    match v {
        None | Some(serde_json::Value::Null) => true,
        Some(serde_json::Value::String(s)) => s.is_empty(),
        _ => false,
    }
}

/// `record[key] ?? fallback` — JS `??` falls through on null/undefined only.
fn js_coalesce<'a>(
    rec: &'a serde_json::Map<String, serde_json::Value>,
    keys: &[&str],
) -> Option<&'a serde_json::Value> {
    for key in keys {
        if let Some(v) = rec.get(*key) {
            if !matches!(v, serde_json::Value::Null) {
                return Some(v);
            }
        }
    }
    None
}

/// Core of `parseKlineRow`: row array -> candle Value, or None when the row is
/// malformed or its candle is still open at `now_ms`.
fn kline_row_to_candle(
    arr: &[serde_json::Value],
    interval_seconds: f64,
    now_ms: f64,
) -> Option<serde_json::Value> {
    if arr.len() < 7 {
        return None;
    }
    let num = |i: usize| js_to_number(&arr[i]);
    let open_ms = num(0);
    let open = num(1);
    let high = num(2);
    let low = num(3);
    let close = num(4);
    let volume = num(5);
    if ![open_ms, open, high, low, close, volume]
        .iter()
        .all(|x| x.is_finite())
    {
        return None;
    }
    // Spec: closed iff close time is strictly before nowMs. row[6] already IS
    // the close time; the floor only tolerates fixtures carrying closeTime=0.
    let close_ms = js_max(num(6), open_ms + interval_seconds * 1_000.0 - 1.0);
    if !close_ms.is_finite() || close_ms >= now_ms {
        return None;
    }
    Some(serde_json::json!({
        "time": (open_ms / 1_000.0).floor(),
        "open": open,
        "high": high,
        "low": low,
        "close": close,
        "volume": volume,
    }))
}

/// Parse one raw Binance REST kline row. Returns a candle object or JS null.
/// Mirrors `parseKlineRow` in src/integrations/binance/klines.ts.
#[wasm_bindgen]
pub fn parse_kline_row(
    row: JsValue,
    interval_seconds: f64,
    now_ms: f64,
) -> Result<JsValue, JsValue> {
    let v = js_value_to_serde(row)?;
    match &v {
        serde_json::Value::Array(a) => match kline_row_to_candle(a, interval_seconds, now_ms) {
            Some(c) => json_out(c),
            None => Ok(JsValue::NULL),
        },
        _ => Ok(JsValue::NULL),
    }
}

/// Batch variant: parse an array of kline rows, dropping malformed/unclosed.
#[wasm_bindgen]
pub fn parse_klines(rows: JsValue, interval_seconds: f64, now_ms: f64) -> Result<JsValue, JsValue> {
    let v = js_value_to_serde(rows)?;
    let arr = match &v {
        serde_json::Value::Array(a) => a,
        _ => return Ok(values_to_js(&[])),
    };
    let mut out = Vec::new();
    for row in arr {
        if let serde_json::Value::Array(a) = row {
            if let Some(c) = kline_row_to_candle(a, interval_seconds, now_ms) {
                out.push(c);
            }
        }
    }
    Ok(values_to_js(&out))
}

/// Detect missing bars between consecutive candles.
/// Mirrors `detectGaps` in src/integrations/binance/klines.ts.
#[wasm_bindgen]
pub fn detect_gaps(
    candles: JsValue,
    interval_seconds: f64,
    tolerance_seconds: Option<f64>,
) -> Result<JsValue, JsValue> {
    let tolerance = tolerance_seconds.unwrap_or(5.0);
    let v = js_value_to_serde(candles)?;
    let arr = match &v {
        serde_json::Value::Array(a) => a,
        _ => {
            return json_out(serde_json::json!({
                "gapCount": 0, "longestGapBars": 0, "missingBars": 0,
            }))
        }
    };
    let mut gap_count = 0u64;
    let mut longest = 0u64;
    let mut missing = 0u64;
    for i in 1..arr.len() {
        let t = |c: &serde_json::Value| c.get("time").and_then(|x| x.as_f64()).unwrap_or(f64::NAN);
        let delta = t(&arr[i]) - t(&arr[i - 1]);
        if delta.is_nan() || delta <= interval_seconds + tolerance {
            continue;
        }
        let gap_bars = js_round(delta / interval_seconds) as i64;
        gap_count += 1;
        longest = longest.max(gap_bars.max(0) as u64);
        missing += (gap_bars - 1).max(0) as u64;
    }
    json_out(serde_json::json!({
        "gapCount": gap_count, "longestGapBars": longest, "missingBars": missing,
    }))
}

// Days-from-civil / civil-from-days (Howard Hinnant's algorithm), proleptic
// Gregorian — matches JS Date UTC fields for positive timestamps.
fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

/// UTC calendar fields for a millisecond timestamp, mirroring `new Date(ms)`
/// getters used by buildDatasetMeta.
fn utc_parts(ms: f64) -> (i64, u32, u32, u32, u32, u32) {
    let days = (ms / 86_400_000.0).floor() as i64;
    let rem = ms - days as f64 * 86_400_000.0;
    let (y, mo, d) = civil_from_days(days);
    let hh = (rem / 3_600_000.0).floor() as u32;
    let mi = ((rem % 3_600_000.0) / 60_000.0).floor() as u32;
    (y, mo, d, hh, mi, 0)
}

fn pad2(v: u32) -> String {
    format!("{:02}", v)
}

/// Build dataset provenance. `checksum` is computed in TS (checksumCandles)
/// because it depends on JS number-to-string formatting.
/// Mirrors `buildDatasetMeta` in src/integrations/binance/klines.ts.
#[wasm_bindgen]
pub fn build_dataset_meta(
    candles: JsValue,
    symbol: &str,
    interval: &str,
    interval_seconds: f64,
    fetched_at: f64,
    checksum: &str,
) -> Result<JsValue, JsValue> {
    let v = js_value_to_serde(candles)?;
    let arr = v.as_array().cloned().unwrap_or_default();
    let candle_time = |i: usize| -> f64 {
        arr.get(i)
            .and_then(|c| c.get("time"))
            .and_then(|t| t.as_f64())
            .unwrap_or(0.0)
    };
    let (y, mo, d, hh, mi, _) = utc_parts(fetched_at);
    let stamp_utc = format!("{}{}{}{}{}", y, pad2(mo), pad2(d), pad2(hh), pad2(mi));
    json_out(serde_json::json!({
        "id": format!("binance-{}-{}-{}-v1", symbol, interval, stamp_utc),
        "name": format!("{} {} Binance REST history", symbol, interval),
        "symbol": symbol,
        "interval": interval,
        "source": "BINANCE_REST",
        "checksum": checksum,
        "candleCount": arr.len(),
        "startTime": if arr.is_empty() { 0.0 } else { candle_time(0) },
        "endTime": if arr.is_empty() { 0.0 } else { candle_time(arr.len() - 1) },
        "intervalSeconds": interval_seconds,
        "fetchedAt": fetched_at,
    }))
}

// Binance symbol aliases mirrored from src/constants/config.ts.
fn normalize_spot_symbol(symbol: &str) -> String {
    let upper = symbol.to_uppercase();
    match upper.as_str() {
        "MATICUSDT" => "POLUSDT".to_string(),
        "RNDRUSDT" => "RENDERUSDT".to_string(),
        "MKRUSDT" => "SKYUSDT".to_string(),
        "FTMUSDT" => "SUSDT".to_string(),
        _ => upper,
    }
}

fn to_futures_symbol(spot: &str) -> String {
    match spot {
        "SHIBUSDT" => "1000SHIBUSDT".to_string(),
        _ => spot.to_string(),
    }
}

/// Resolve a spot instrument to its USDⓈ-M contract and unit multiplier.
/// Mirrors `getBinanceFuturesContract` in src/integrations/binance/contracts.ts.
#[wasm_bindgen]
pub fn futures_contract(symbol: &str) -> Result<JsValue, JsValue> {
    let spot = normalize_spot_symbol(symbol);
    let futures = to_futures_symbol(&spot);
    fn strip_usdt(s: &str) -> &str {
        s.strip_suffix("USDT").unwrap_or(s)
    }
    let spot_base = strip_usdt(&spot);
    let futures_base = strip_usdt(&futures);
    // /^(\\d+)(.+)$/ on futuresBase: numeric prefix + remainder must equal spotBase.
    let digits_len = futures_base
        .bytes()
        .take_while(|b| b.is_ascii_digit())
        .count();
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
    json_out(serde_json::json!({
        "spotSymbol": spot,
        "futuresSymbol": futures,
        "multiplier": multiplier,
    }))
}

#[wasm_bindgen]
pub fn normalize_futures_price(price: f64, multiplier: f64) -> f64 {
    price / multiplier
}

#[wasm_bindgen]
pub fn normalize_futures_quantity(quantity: f64, multiplier: f64) -> f64 {
    quantity * multiplier
}

/// Parse and validate the three Binance Futures REST payloads into a
/// DerivativesSnapshot. Throws Error on malformed input, matching
/// `parseDerivativesSnapshot` in src/integrations/binance/derivatives.ts.
#[wasm_bindgen]
pub fn parse_derivatives_snapshot(
    premium_payload: JsValue,
    interest_payload: JsValue,
    ratios_payload: JsValue,
    expected_futures_symbol: &str,
    contract_multiplier: f64,
    received_at: Option<f64>,
) -> Result<JsValue, JsValue> {
    let err = |msg: &str| js_err(msg);
    let premium_v = js_value_to_serde(premium_payload)?;
    let interest_v = js_value_to_serde(interest_payload)?;
    let ratios_v = js_value_to_serde(ratios_payload)?;
    let premium =
        as_record(&premium_v).ok_or_else(|| js_err("Malformed premium index response"))?;
    let interest =
        as_record(&interest_v).ok_or_else(|| js_err("Malformed open interest response"))?;
    let ratios = match &ratios_v {
        serde_json::Value::Array(a) if !a.is_empty() => a,
        _ => return Err(err("Malformed long/short ratio response")),
    };
    let ratio_v = ratios.last().unwrap().clone();
    let ratio = as_record(&ratio_v).ok_or_else(|| js_err("Malformed long/short ratio"))?;

    // responseSymbols: only string values participate; missing symbols are
    // filtered out rather than counted as mismatches.
    for rec in [premium, interest, ratio] {
        if let Some(s) = rec.get("symbol").and_then(|x| x.as_str()) {
            if s != expected_futures_symbol {
                return Err(err("Binance Futures returned a mismatched instrument"));
            }
        }
    }

    let read_num = |rec: &serde_json::Map<String, serde_json::Value>,
                    key: &str,
                    label: &str|
     -> Result<f64, JsValue> {
        let raw = rec.get(key);
        if is_nullish_or_empty(raw) {
            return Err(err(&format!("Malformed {}", label)));
        }
        let parsed = js_to_number(raw.unwrap());
        if !parsed.is_finite() {
            return Err(err(&format!("Malformed {}", label)));
        }
        Ok(parsed)
    };
    let positive = |v: f64, label: &str| -> Result<f64, JsValue> {
        if v <= 0.0 {
            return Err(err(&format!("Malformed {}", label)));
        }
        Ok(v)
    };

    let raw_mark = positive(read_num(premium, "markPrice", "mark price")?, "mark price")?;
    let raw_index = positive(
        read_num(premium, "indexPrice", "index price")?,
        "index price",
    )?;
    let funding_rate = read_num(premium, "lastFundingRate", "funding rate")?;
    let next_funding = positive(
        read_num(premium, "nextFundingTime", "funding time")?,
        "funding time",
    )?;
    let raw_oi = read_num(interest, "openInterest", "open interest")?;
    let long_account = read_num(ratio, "longAccount", "long account ratio")?;
    let short_account = read_num(ratio, "shortAccount", "short account ratio")?;

    if raw_oi < 0.0 {
        return Err(err("Malformed open interest"));
    }
    if !(0.0..=1.0).contains(&long_account) || !(0.0..=1.0).contains(&short_account) {
        return Err(err("Malformed long/short account ratios"));
    }
    if ((long_account + short_account) - 1.0).abs() > 0.02 {
        return Err(err("Inconsistent long/short account ratios"));
    }

    json_out(serde_json::json!({
        "markPrice": raw_mark / contract_multiplier,
        "indexPrice": raw_index / contract_multiplier,
        "fundingRate": funding_rate,
        "nextFundingTime": next_funding,
        "openInterest": raw_oi * contract_multiplier,
        "longAccount": long_account,
        "shortAccount": short_account,
        "updatedAt": received_at.unwrap_or_else(now_ms),
    }))
}

/// Parse a Binance Futures `!forceOrder@arr` message.
/// Mirrors `parseBinanceLiquidation` in src/integrations/binance/liquidations.ts.
#[wasm_bindgen]
pub fn parse_liquidation(value: JsValue) -> Result<JsValue, JsValue> {
    let v = js_value_to_serde(value)?;
    let message = as_record(&v);
    let order = message.and_then(|m| m.get("o")).and_then(as_record);
    let is_force = message.and_then(|m| m.get("e")).and_then(|e| e.as_str()) == Some("forceOrder");
    let order = match (is_force, order) {
        (true, Some(o)) => o,
        _ => return Ok(JsValue::NULL),
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

    let symbol = order.get("s").and_then(|s| s.as_str());
    let side = order.get("S").and_then(|s| s.as_str());
    let (symbol, side) = match (symbol, side) {
        (Some(s), Some(side @ ("BUY" | "SELL"))) => (s, side),
        _ => return Ok(JsValue::NULL),
    };
    let (price, quantity) = match (price, quantity) {
        (Some(p), Some(q)) if time.is_finite() && time > 0.0 => (p, q),
        _ => return Ok(JsValue::NULL),
    };

    json_out(serde_json::json!({
        "symbol": symbol.to_uppercase(),
        "side": side,
        "price": price,
        "quantity": quantity,
        "value": price * quantity,
        "time": time,
        "isBuy": side == "BUY",
    }))
}

/// Parse one Binance ticker payload (REST 24hr or miniTicker WS) into the
/// display/store pair used by the market watch.
/// `assets` is the TOP_CRYPTOS array [{symbol,name,category}] passed from TS.
/// Mirrors `parseTicker` in src/integrations/binance/watchlist.ts.
#[wasm_bindgen]
pub fn parse_ticker(value: JsValue, assets: JsValue) -> Result<JsValue, JsValue> {
    let v = js_value_to_serde(value)?;
    let ticker = match as_record(&v) {
        Some(t) => t,
        None => return Ok(JsValue::NULL),
    };
    let raw_symbol = js_coalesce(ticker, &["symbol", "s"]);
    let raw_symbol = match raw_symbol.and_then(|s| s.as_str()) {
        Some(s) => s,
        None => return Ok(JsValue::NULL),
    };
    let symbol = raw_symbol.to_uppercase();

    // Asset metadata lookup: {symbol -> {name, category}}.
    let assets_v = js_value_to_serde(assets)?;
    let meta = assets_v.as_array().and_then(|arr| {
        arr.iter().find_map(|a| {
            let rec = a.as_object()?;
            (rec.get("symbol").and_then(|s| s.as_str()) == Some(symbol.as_str())).then(|| {
                (
                    rec.get("name")
                        .and_then(|n| n.as_str())
                        .unwrap_or("")
                        .to_string(),
                    rec.get("category")
                        .and_then(|c| c.as_str())
                        .unwrap_or("")
                        .to_string(),
                )
            })
        })
    });
    let (name, category) = match meta {
        Some(m) => m,
        None => return Ok(JsValue::NULL),
    };

    let read_num = |long: &str, short: &str| -> f64 {
        let raw = js_coalesce(ticker, &[long, short]);
        match raw {
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
        return Ok(JsValue::NULL);
    }

    let provider_ts = js_coalesce(ticker, &["eventTime", "E", "closeTime", "C"])
        .map(js_to_number)
        .unwrap_or(f64::NAN);
    let timestamp = if provider_ts.is_finite() && provider_ts > 1_000_000_000_000.0 {
        provider_ts
    } else {
        0.0
    };

    json_out(serde_json::json!({
        "display": {
            "symbol": symbol,
            "name": name,
            "category": category,
            "price": price,
            "priceChangePercent": price_change_percent,
            "quoteVolume": quote_volume,
        },
        "store": {
            "symbol": symbol,
            "price": price,
            "priceChange": price_change,
            "priceChangePercent": price_change_percent,
            "volume": read_num("volume", "v"),
            "quoteVolume": quote_volume,
            "high": read_num("highPrice", "h"),
            "low": read_num("lowPrice", "l"),
            "timestamp": timestamp,
        },
    }))
}

/// Unwrap a combined-stream WS payload: array payloads pass through, objects
/// with a `data` record yield [data], everything else yields [].
/// Mirrors `extractTickerValues` in src/integrations/binance/watchlist.ts.
#[wasm_bindgen]
pub fn extract_ticker_values(payload: JsValue) -> Result<JsValue, JsValue> {
    let v = js_value_to_serde(payload)?;
    match &v {
        serde_json::Value::Array(_) => Ok(value_to_js(&v)),
        serde_json::Value::Object(map) => match map.get("data") {
            Some(d @ serde_json::Value::Object(_)) => Ok(values_to_js(std::slice::from_ref(d))),
            _ => Ok(values_to_js(&[])),
        },
        _ => Ok(values_to_js(&[])),
    }
}

// ===================== Backtest engine (backtest-v1) =====================
// Mirrors src/backtest/engine.ts. Golden values are shared with the C++20
// core under engine/ via schemas/backtest-v1.schema.json.

const BPS_DIVISOR: f64 = 10_000.0;
const SECONDS_PER_YEAR: f64 = 31_536_000.0;

#[derive(Clone, Copy)]
struct OpenPosition {
    entry_time: f64,
    entry_bar_index: usize,
    entry_price: f64,
    quantity: f64,
    entry_fee: f64,
}

#[derive(Clone, Copy)]
struct TradeRec {
    entry_time: f64,
    exit_time: f64,
    entry_price: f64,
    exit_price: f64,
    quantity: f64,
    entry_fee: f64,
    exit_fee: f64,
    gross_pnl: f64,
    net_pnl: f64,
    return_pct: f64,
    bars_held: i64,
    exit_reason: &'static str,
}

// JS property read that yields NaN for missing/non-numeric values, matching
// Number.isFinite(undefined) === false semantics used by the TS validator.
fn js_prop_num(obj: &JsValue, key: &str) -> f64 {
    js_sys::Reflect::get(obj, &JsValue::from_str(key))
        .ok()
        .and_then(|v| v.as_f64())
        .unwrap_or(f64::NAN)
}

fn js_prop_str(obj: &JsValue, key: &str) -> Option<String> {
    js_sys::Reflect::get(obj, &JsValue::from_str(key))
        .ok()
        .and_then(|v| v.as_string())
}

struct ValidatedBacktest {
    candles: Vec<Candle>,
    initial_capital: f64,
    fast_period: usize,
    slow_period: usize,
    fee_bps: f64,
    slippage_bps: f64,
    interval_seconds: f64,
}

fn validate_backtest_input(
    candles_js: &JsValue,
    config: &JsValue,
    dataset: &JsValue,
) -> Result<ValidatedBacktest, JsValue> {
    let initial_capital = js_prop_num(config, "initialCapital");
    if !initial_capital.is_finite() || initial_capital <= 0.0 {
        return Err(js_err(
            "Initial capital must be a finite number greater than zero",
        ));
    }

    let interval_seconds = js_prop_num(dataset, "intervalSeconds");
    if !interval_seconds.is_finite() || interval_seconds <= 0.0 {
        return Err(js_err("Interval seconds must be finite and positive"));
    }

    let fast_period_f = js_prop_num(config, "fastPeriod");
    let slow_period_f = js_prop_num(config, "slowPeriod");
    let fee_bps = js_prop_num(config, "feeBps");
    let slippage_bps = js_prop_num(config, "slippageBps");

    let is_integer = |v: f64| v.is_finite() && v.fract() == 0.0;
    if !is_integer(fast_period_f) || fast_period_f < 2.0 {
        return Err(js_err("Fast period must be an integer of at least 2"));
    }
    if !is_integer(slow_period_f) || slow_period_f <= fast_period_f {
        return Err(js_err(
            "Slow period must be an integer greater than the fast period",
        ));
    }
    if !fee_bps.is_finite() || fee_bps < 0.0 || fee_bps > 1_000.0 {
        return Err(js_err("Fee must be between 0 and 1,000 basis points"));
    }
    if !slippage_bps.is_finite() || slippage_bps < 0.0 || slippage_bps > 1_000.0 {
        return Err(js_err("Slippage must be between 0 and 1,000 basis points"));
    }

    let arr = candles_js
        .dyn_ref::<js_sys::Array>()
        .ok_or_else(|| js_err("candles must be an array"))?;
    let count = arr.length() as usize;
    if (count as f64) < slow_period_f + 2.0 {
        return Err(js_err(&format!(
            "At least {} candles are required",
            slow_period_f + 2.0
        )));
    }

    let mut candles = Vec::with_capacity(count);
    for i in 0..count {
        let item = arr.get(i as u32);
        candles.push(Candle {
            time: js_prop_num(&item, "time"),
            open: js_prop_num(&item, "open"),
            high: js_prop_num(&item, "high"),
            low: js_prop_num(&item, "low"),
            close: js_prop_num(&item, "close"),
            volume: js_prop_num(&item, "volume"),
        });
    }

    for (index, candle) in candles.iter().enumerate() {
        let values = [
            candle.time,
            candle.open,
            candle.high,
            candle.low,
            candle.close,
            candle.volume,
        ];
        if values.iter().any(|v| !v.is_finite()) {
            return Err(js_err(&format!(
                "Candle {} contains a non-finite value",
                index
            )));
        }
        if candle.open <= 0.0
            || candle.high <= 0.0
            || candle.low <= 0.0
            || candle.close <= 0.0
            || candle.volume < 0.0
        {
            return Err(js_err(&format!(
                "Candle {} contains an invalid market value",
                index
            )));
        }
        if candle.high < candle.open.max(candle.close)
            || candle.low > candle.open.min(candle.close)
            || candle.low > candle.high
        {
            return Err(js_err(&format!(
                "Candle {} has inconsistent OHLC bounds",
                index
            )));
        }
        if index > 0 && candle.time <= candles[index - 1].time {
            return Err(js_err("Candle timestamps must be strictly increasing"));
        }
    }

    Ok(ValidatedBacktest {
        candles,
        initial_capital,
        fast_period: fast_period_f as usize,
        slow_period: slow_period_f as usize,
        fee_bps,
        slippage_bps,
        interval_seconds,
    })
}

fn sma_spreads(candles: &[Candle], fast_period: usize, slow_period: usize) -> Vec<Option<f64>> {
    let mut spreads = vec![None; candles.len()];
    let mut fast_sum = 0.0f64;
    let mut slow_sum = 0.0f64;

    for (index, candle) in candles.iter().enumerate() {
        let close = candle.close;
        fast_sum += close;
        slow_sum += close;

        if index >= fast_period {
            fast_sum -= candles[index - fast_period].close;
        }
        if index >= slow_period {
            slow_sum -= candles[index - slow_period].close;
        }

        if index >= slow_period - 1 {
            spreads[index] = Some(fast_sum / fast_period as f64 - slow_sum / slow_period as f64);
        }
    }

    spreads
}

fn sharpe_ratio(equities: &[f64], bars_per_year: f64) -> f64 {
    if equities.len() < 3 {
        return 0.0;
    }
    let mut returns = Vec::with_capacity(equities.len() - 1);
    for index in 1..equities.len() {
        let previous = equities[index - 1];
        if previous > 0.0 {
            returns.push(equities[index] / previous - 1.0);
        }
    }
    if returns.len() < 2 {
        return 0.0;
    }
    let mean = returns.iter().sum::<f64>() / returns.len() as f64;
    let variance =
        returns.iter().map(|v| (v - mean) * (v - mean)).sum::<f64>() / (returns.len() - 1) as f64;
    let deviation = variance.sqrt();
    if deviation == 0.0 {
        0.0
    } else {
        (mean / deviation) * bars_per_year.sqrt()
    }
}

struct ExitFill {
    time: f64,
    bar_index: usize,
    raw_price: f64,
}

fn close_position(
    position: &OpenPosition,
    exit: ExitFill,
    cash: f64,
    fee_rate: f64,
    slippage_rate: f64,
    exit_reason: &'static str,
) -> (f64, TradeRec) {
    let exit_price = exit.raw_price * (1.0 - slippage_rate);
    let proceeds = position.quantity * exit_price;
    let exit_fee = proceeds * fee_rate;
    let gross_pnl = (exit_price - position.entry_price) * position.quantity;
    let net_pnl = gross_pnl - position.entry_fee - exit_fee;

    (
        cash + proceeds - exit_fee,
        TradeRec {
            entry_time: position.entry_time,
            exit_time: exit.time,
            entry_price: position.entry_price,
            exit_price,
            quantity: position.quantity,
            entry_fee: position.entry_fee,
            exit_fee,
            gross_pnl,
            net_pnl,
            return_pct: (exit_price / position.entry_price - 1.0) * 100.0,
            bars_held: exit.bar_index as i64 - position.entry_bar_index as i64,
            exit_reason,
        },
    )
}

fn trade_to_json(trade: &TradeRec, trade_number: usize) -> serde_json::Value {
    serde_json::json!({
        "id": format!("trade-{}", trade_number),
        "side": "LONG",
        "entryTime": trade.entry_time,
        "exitTime": trade.exit_time,
        "entryPrice": trade.entry_price,
        "exitPrice": trade.exit_price,
        "quantity": trade.quantity,
        "entryFee": trade.entry_fee,
        "exitFee": trade.exit_fee,
        "grossPnl": trade.gross_pnl,
        "netPnl": trade.net_pnl,
        "returnPct": trade.return_pct,
        "barsHeld": trade.bars_held,
        "exitReason": trade.exit_reason,
    })
}

fn run_validated(v: &ValidatedBacktest) -> serde_json::Value {
    let fee_rate = v.fee_bps / BPS_DIVISOR;
    let slippage_rate = v.slippage_bps / BPS_DIVISOR;
    let spreads = sma_spreads(&v.candles, v.fast_period, v.slow_period);
    let mut trades: Vec<TradeRec> = Vec::new();
    // (time, equity, drawdownPct, positionQuantity)
    let mut equity_curve: Vec<(f64, f64, f64, f64)> = Vec::with_capacity(v.candles.len());

    let mut cash = v.initial_capital;
    let mut position: Option<OpenPosition> = None;
    let mut peak_equity = v.initial_capital;
    let mut exposed_bars = 0usize;

    for (index, candle) in v.candles.iter().enumerate() {
        if index > 0 {
            let signal = spreads[index - 1];
            let prior_signal = if index > 1 { spreads[index - 2] } else { None };
            let prior_value = prior_signal.unwrap_or(0.0);
            let crossed_up = signal.is_some_and(|s| s > 0.0) && prior_value <= 0.0;
            let crossed_down = signal.is_some_and(|s| s < 0.0) && prior_value >= 0.0;

            if position.is_none() && crossed_up {
                let entry_price = candle.open * (1.0 + slippage_rate);
                let quantity = cash / (entry_price * (1.0 + fee_rate));
                let entry_notional = quantity * entry_price;
                let entry_fee = entry_notional * fee_rate;
                cash = (cash - entry_notional - entry_fee).max(0.0);
                position = Some(OpenPosition {
                    entry_time: candle.time,
                    entry_bar_index: index,
                    entry_price,
                    quantity,
                    entry_fee,
                });
            } else if position.is_some() && crossed_down {
                let pos = position.take().unwrap();
                let (new_cash, trade) = close_position(
                    &pos,
                    ExitFill {
                        time: candle.time,
                        bar_index: index,
                        raw_price: candle.open,
                    },
                    cash,
                    fee_rate,
                    slippage_rate,
                    "SIGNAL",
                );
                cash = new_cash;
                trades.push(trade);
            }
        }

        if position.is_some() {
            exposed_bars += 1;
        }

        let mut equity = cash + position.map_or(0.0, |p| p.quantity) * candle.close;
        if index == v.candles.len() - 1 && position.is_some() {
            let pos = position.take().unwrap();
            let (new_cash, trade) = close_position(
                &pos,
                ExitFill {
                    time: candle.time,
                    bar_index: index,
                    raw_price: candle.close,
                },
                cash,
                fee_rate,
                slippage_rate,
                "END_OF_DATA",
            );
            cash = new_cash;
            trades.push(trade);
            equity = cash;
        }

        peak_equity = peak_equity.max(equity);
        let drawdown_pct = if peak_equity == 0.0 {
            0.0
        } else {
            (peak_equity - equity) / peak_equity * 100.0
        };
        equity_curve.push((
            candle.time,
            equity,
            drawdown_pct,
            position.map_or(0.0, |p| p.quantity),
        ));
    }

    let final_equity = equity_curve
        .last()
        .map(|p| p.1)
        .unwrap_or(v.initial_capital);
    // `+ 0.0` normalises the -0.0 that `f64::sum` yields for empty iterators,
    // matching the JS `reduce(..., 0)` seed of +0.
    let winning_pnl: f64 = trades
        .iter()
        .filter(|t| t.net_pnl > 0.0)
        .map(|t| t.net_pnl)
        .sum::<f64>()
        + 0.0;
    let losing_pnl: f64 = trades
        .iter()
        .filter(|t| t.net_pnl < 0.0)
        .map(|t| t.net_pnl)
        .sum::<f64>()
        .abs();
    let max_drawdown_pct = equity_curve.iter().map(|p| p.2).fold(0.0f64, f64::max);
    let total_trades = trades.len();
    let win_rate_pct = if total_trades == 0 {
        0.0
    } else {
        trades.iter().filter(|t| t.net_pnl > 0.0).count() as f64 / total_trades as f64 * 100.0
    };
    let bars_per_year = SECONDS_PER_YEAR / v.interval_seconds;
    let equities: Vec<f64> = equity_curve.iter().map(|p| p.1).collect();

    let metrics = serde_json::json!({
        "initialCapital": v.initial_capital,
        "finalEquity": final_equity,
        "totalReturnPct": (final_equity / v.initial_capital - 1.0) * 100.0,
        "maxDrawdownPct": max_drawdown_pct,
        "totalTrades": total_trades,
        "winRatePct": win_rate_pct,
        "profitFactor": if losing_pnl == 0.0 { serde_json::Value::Null } else { serde_json::json!(winning_pnl / losing_pnl) },
        "sharpeRatio": sharpe_ratio(&equities, bars_per_year),
        "totalFees": trades.iter().fold(0.0f64, |sum, t| sum + t.entry_fee + t.exit_fee),
        "exposurePct": exposed_bars as f64 / equity_curve.len() as f64 * 100.0,
    });

    let trades_json: Vec<serde_json::Value> = trades
        .iter()
        .enumerate()
        .map(|(i, t)| trade_to_json(t, i + 1))
        .collect();
    let equity_json: Vec<serde_json::Value> = equity_curve
        .iter()
        .map(|(time, equity, dd, qty)| {
            serde_json::json!({
                "time": time,
                "equity": equity,
                "drawdownPct": dd,
                "positionQuantity": qty,
            })
        })
        .collect();

    serde_json::json!({
        "metrics": metrics,
        "trades": trades_json,
        "equityCurve": equity_json,
    })
}

// Shallow-copies a JS object the way `{ ...config }` does in the TS engine.
fn shallow_copy_js_object(src: &JsValue) -> JsValue {
    let out = js_sys::Object::new();
    if let Ok(keys) = js_sys::Reflect::own_keys(src) {
        for i in 0..keys.length() {
            let key = keys.get(i);
            if key.is_string() {
                if let Ok(val) = js_sys::Reflect::get(src, &key) {
                    let _ = js_sys::Reflect::set(&out, &key, &val);
                }
            }
        }
    }
    out.into()
}

fn assemble_result(
    dataset: &JsValue,
    config: &JsValue,
    computed: serde_json::Value,
    source: Option<&str>,
) -> JsValue {
    let obj = js_sys::Object::new();
    let set = |key: &str, val: &JsValue| {
        let _ = js_sys::Reflect::set(&obj, &JsValue::from_str(key), val);
    };
    set("contractVersion", &JsValue::from_str("backtest-v1"));
    set("engine", &JsValue::from_str("RUST_WASM"));
    set("strategy", &JsValue::from_str("SMA_CROSS_LONG_FLAT"));
    set("dataset", dataset);
    let config_copy = shallow_copy_js_object(config);
    set("config", &config_copy);
    if let serde_json::Value::Object(map) = &computed {
        for (key, val) in map {
            let js_val = value_to_js(val);
            set(key, &js_val);
        }
    }

    let warnings = js_sys::Array::new();
    if source == Some("SYNTHETIC_FIXTURE") {
        warnings.push(&JsValue::from_str(
            "Synthetic validation data is not evidence of live strategy performance.",
        ));
    }
    warnings.push(&JsValue::from_str(
        "This first slice models long/flat market orders only.",
    ));
    if source == Some("BINANCE_REST") {
        warnings.push(&JsValue::from_str(
            "Real market data may contain exchange outage gaps; listed-pair history carries survivorship bias.",
        ));
    }
    let diagnostics = js_sys::Object::new();
    let _ = js_sys::Reflect::set(
        &diagnostics,
        &JsValue::from_str("deterministic"),
        &JsValue::from_bool(true),
    );
    let _ = js_sys::Reflect::set(
        &diagnostics,
        &JsValue::from_str("executionTiming"),
        &JsValue::from_str("NEXT_BAR_OPEN"),
    );
    let _ = js_sys::Reflect::set(
        &diagnostics,
        &JsValue::from_str("priceModel"),
        &JsValue::from_str("MARKET_WITH_BPS_COSTS"),
    );
    let _ = js_sys::Reflect::set(&diagnostics, &JsValue::from_str("warnings"), &warnings);
    set("diagnostics", &diagnostics);

    obj.into()
}

/// Runs the backtest-v1 SMA crossover engine. Mirrors `runSmaCrossBacktest`
/// in src/backtest/engine.ts; the TS wrapper preserves the public API.
#[wasm_bindgen]
pub fn run_sma_cross_backtest(
    candles: JsValue,
    dataset: JsValue,
    config: JsValue,
) -> Result<JsValue, JsValue> {
    let validated = validate_backtest_input(&candles, &config, &dataset)?;
    let computed = run_validated(&validated);
    let source = js_prop_str(&dataset, "source");
    Ok(assemble_result(
        &dataset,
        &config,
        computed,
        source.as_deref(),
    ))
}

/// Validation-only entry point mirroring `validateBacktestInput`.
#[wasm_bindgen]
pub fn validate_backtest_input_js(
    candles: JsValue,
    config: JsValue,
    dataset: JsValue,
) -> Result<(), JsValue> {
    validate_backtest_input(&candles, &config, &dataset).map(|_| ())
}

// ===================== Typed Rust API (non-wasm_bindgen) =====================
// Plain-Rust surface for native/wasm callers such as quant-ui. Every function
// reuses the exact implementations behind the `#[wasm_bindgen]` exports above;
// `JsValue` is used internally only as a transport for the microstructure cores
// and payload parsers whose state machines are already implemented there.

pub mod typed {
    use super::*;
    pub use super::{OfiBookCalculator, TradeClassifierCore, VpinCalculatorCore};
    use serde::{Deserialize, Serialize};

    // ---------- JsValue transport helpers ----------

    fn jserr_to_string(v: JsValue) -> String {
        if let Some(err) = v.dyn_ref::<js_sys::Error>() {
            return err.message().as_string().unwrap_or_default();
        }
        v.as_string().unwrap_or_else(|| "unknown error".to_string())
    }

    fn to_js<T: Serialize>(v: &T) -> Result<JsValue, String> {
        serde_wasm_bindgen::to_value(v).map_err(|e| e.to_string())
    }

    fn from_js<T: serde::de::DeserializeOwned>(v: JsValue) -> Result<T, String> {
        serde_wasm_bindgen::from_value(v).map_err(|e| e.to_string())
    }

    fn candles_js(data: &[Candle]) -> Result<JsValue, String> {
        to_js(&data.to_vec())
    }

    /// JavaScript `Number -> String` coercion used by the fixture checksum.
    /// On wasm this delegates to `JSON.stringify`, which shares the ECMAScript
    /// Number::toString algorithm. The fallback covers non-wasm targets and is
    /// exact for the magnitudes candles carry (it only diverges in the
    /// exponent-notation edge ranges).
    fn js_num_to_string(v: f64) -> String {
        if v == 0.0 {
            // Covers -0 as well: String(-0) === "0".
            return "0".to_string();
        }
        #[cfg(target_arch = "wasm32")]
        {
            if let Ok(j) = js_sys::JSON::stringify(&JsValue::from_f64(v)) {
                if let Some(s) = j.as_string() {
                    return s;
                }
            }
        }
        let a = v.abs();
        if a >= 1e21 || a < 1e-6 {
            // Exponent notation approximation ("1e+21", "1.5e-7").
            let s = format!("{:e}", v);
            if let Some((mantissa, exp)) = s.split_once('e') {
                let mantissa = mantissa.trim_end_matches(".0");
                let exp: i32 = exp.parse().unwrap_or(0);
                let sign = if exp >= 0 { "+" } else { "-" };
                return format!("{}e{}{}", mantissa, sign, exp.abs());
            }
            return s;
        }
        if v.fract() == 0.0 && a < 9.0e18 {
            return format!("{}", v as i64);
        }
        format!("{}", v)
    }

    // ---------- Indicators (typed wrappers over the wasm_bindgen exports) ----------

    pub fn vwap(data: &[Candle]) -> Result<Vec<IndicatorValue>, String> {
        let out = calculate_vwap(candles_js(data)?).map_err(jserr_to_string)?;
        from_js(out)
    }

    pub fn sma(data: &[Candle], period: u32) -> Result<Vec<IndicatorValue>, String> {
        let out = calculate_sma(candles_js(data)?, period).map_err(jserr_to_string)?;
        from_js(out)
    }

    pub fn ema(data: &[Candle], period: u32) -> Result<Vec<IndicatorValue>, String> {
        let out = calculate_ema(candles_js(data)?, period).map_err(jserr_to_string)?;
        from_js(out)
    }

    pub fn rsi(data: &[Candle], period: u32) -> Result<Vec<IndicatorValue>, String> {
        let out = calculate_rsi(candles_js(data)?, period).map_err(jserr_to_string)?;
        from_js(out)
    }

    pub fn bollinger_bands(
        data: &[Candle],
        period: u32,
        std_dev: f64,
    ) -> Result<Vec<BollingerBandsValue>, String> {
        let out =
            calculate_bollinger_bands(candles_js(data)?, period, std_dev).map_err(jserr_to_string)?;
        from_js(out)
    }

    pub fn macd(
        data: &[Candle],
        fast_period: u32,
        slow_period: u32,
        signal_period: u32,
    ) -> Result<Vec<MacdValue>, String> {
        let out = calculate_macd(candles_js(data)?, fast_period, slow_period, signal_period)
            .map_err(jserr_to_string)?;
        from_js(out)
    }

    pub fn atr(data: &[Candle], period: u32) -> Result<Vec<IndicatorValue>, String> {
        let out = calculate_atr(candles_js(data)?, period).map_err(jserr_to_string)?;
        from_js(out)
    }

    pub fn obv(data: &[Candle]) -> Result<Vec<IndicatorValue>, String> {
        let out = calculate_obv(candles_js(data)?).map_err(jserr_to_string)?;
        from_js(out)
    }

    pub fn adx(data: &[Candle], period: u32) -> Result<Vec<IndicatorValue>, String> {
        let out = calculate_adx(candles_js(data)?, period).map_err(jserr_to_string)?;
        from_js(out)
    }

    pub fn hurst(data: &[Candle]) -> Result<f64, String> {
        let v = calculate_hurst(candles_js(data)?).map_err(jserr_to_string)?;
        v.as_f64().ok_or_else(|| "invalid hurst result".to_string())
    }

    /// Order-flow imbalance over a tape of trades (quantity + maker flag).
    #[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct TradeVolume {
        pub quantity: f64,
        #[serde(rename = "isBuyerMaker")]
        pub is_buyer_maker: bool,
    }

    #[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct TapeOfi {
        pub buy_volume: f64,
        pub sell_volume: f64,
        pub net_volume: f64,
        pub imbalance_ratio: f64,
    }

    pub fn tape_ofi(trades: &[TradeVolume]) -> Result<TapeOfi, String> {
        let out = calculate_ofi(to_js(&trades.to_vec())?).map_err(jserr_to_string)?;
        from_js(out)
    }

    // ---------- Microstructure cores (typed wrappers) ----------

    /// Raw aggregate-trade event as delivered by `@aggTrade`.
    #[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct AggTrade {
        pub id: f64,
        pub price: f64,
        pub quantity: f64,
        pub timestamp: f64,
        #[serde(rename = "isBuyerMaker")]
        pub is_buyer_maker: bool,
    }

    #[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
    pub enum OrderSide {
        #[serde(rename = "buy")]
        Buy,
        #[serde(rename = "sell")]
        Sell,
    }

    #[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
    pub enum ClassificationMethod {
        #[serde(rename = "tick")]
        Tick,
        #[serde(rename = "quote")]
        Quote,
        #[serde(rename = "exchange")]
        Exchange,
    }

    #[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct ClassifiedTrade {
        pub id: f64,
        pub price: f64,
        pub quantity: f64,
        pub timestamp: f64,
        #[serde(rename = "isBuyerMaker")]
        pub is_buyer_maker: bool,
        pub side: OrderSide,
        pub classification_method: ClassificationMethod,
    }

    /// Exchange-taker-side classification — mirrors `classifyFromExchange`.
    pub fn classify_from_exchange(
        core: &mut TradeClassifierCore,
        trade: &AggTrade,
    ) -> Result<ClassifiedTrade, String> {
        let out = core
            .classify_from_exchange(to_js(trade)?)
            .map_err(jserr_to_string)?;
        from_js(out)
    }

    #[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct VolumeDelta {
        pub buy_volume: f64,
        pub sell_volume: f64,
        pub delta: f64,
        pub delta_percent: f64,
        pub timestamp: f64,
    }

    /// Rolling buy/sell volume delta. `window_ms` is measured against the
    /// wall clock, matching the JS implementation (`Date.now()` inside).
    pub fn volume_delta(core: &TradeClassifierCore, window_ms: f64) -> VolumeDelta {
        let v = core.calculate_volume_delta(window_ms);
        from_js(v).unwrap_or(VolumeDelta {
            buy_volume: 0.0,
            sell_volume: 0.0,
            delta: 0.0,
            delta_percent: 0.0,
            timestamp: 0.0,
        })
    }

    pub fn buy_sell_ratio(core: &TradeClassifierCore, window_ms: f64) -> f64 {
        core.get_buy_sell_ratio(window_ms)
    }

    #[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
    pub struct PricePoint {
        pub timestamp: f64,
        pub price: f64,
    }

    #[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
    pub enum DivergenceKind {
        #[serde(rename = "bullish")]
        Bullish,
        #[serde(rename = "bearish")]
        Bearish,
    }

    #[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
    pub struct Divergence {
        #[serde(rename = "type")]
        pub kind: Option<DivergenceKind>,
        pub strength: f64,
    }

    pub fn detect_divergence(core: &TradeClassifierCore, prices: &[PricePoint]) -> Divergence {
        let js = to_js(&prices.to_vec()).unwrap_or(JsValue::NULL);
        let out = core.detect_divergence(js);
        from_js(out).unwrap_or(Divergence {
            kind: None,
            strength: 0.0,
        })
    }

    #[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
    pub enum VpinToxicity {
        #[serde(rename = "low")]
        Low,
        #[serde(rename = "medium")]
        Medium,
        #[serde(rename = "high")]
        High,
        #[serde(rename = "extreme")]
        Extreme,
    }

    #[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct VpinBucket {
        pub bucket_number: u32,
        pub buy_volume: f64,
        pub sell_volume: f64,
        pub total_volume: f64,
        pub imbalance: f64,
        pub timestamp: f64,
    }

    #[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct VpinResult {
        pub vpin: f64,
        pub toxicity: VpinToxicity,
        pub buckets_filled: usize,
        pub current_bucket: VpinBucket,
        pub timestamp: f64,
    }

    #[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
    pub enum VpinTrend {
        #[serde(rename = "increasing")]
        Increasing,
        #[serde(rename = "decreasing")]
        Decreasing,
        #[serde(rename = "stable")]
        Stable,
    }

    /// Add a classified trade; returns `Some(result)` once enough buckets are
    /// filled, mirroring `VPINCalculator.addTrade`.
    pub fn vpin_add_trade(
        core: &mut VpinCalculatorCore,
        trade: &ClassifiedTrade,
    ) -> Result<Option<VpinResult>, String> {
        let out = core.add_trade(to_js(trade)?).map_err(jserr_to_string)?;
        if out.is_null() {
            Ok(None)
        } else {
            from_js(out).map(Some)
        }
    }

    pub fn vpin_trend(core: &VpinCalculatorCore, lookback: u32) -> VpinTrend {
        match core.get_vpin_trend(lookback).as_string().as_deref() {
            Some("increasing") => VpinTrend::Increasing,
            Some("decreasing") => VpinTrend::Decreasing,
            _ => VpinTrend::Stable,
        }
    }

    pub fn vpin_bucket_progress(core: &VpinCalculatorCore) -> f64 {
        core.get_current_bucket_progress()
    }

    /// Order-book depth snapshot: (price, quantity) string pairs, matching the
    /// Binance `@depth20` payload shape consumed by `OfiBookCalculator`.
    #[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
    pub struct BookSnapshotIn {
        pub bids: Vec<(String, String)>,
        pub asks: Vec<(String, String)>,
        pub timestamp: f64,
    }

    #[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct OfiDepth {
        pub ofi: f64,
        pub bid_pressure: f64,
        pub ask_pressure: f64,
        pub total_volume: f64,
        pub timestamp: f64,
    }

    #[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
    pub enum OfiEventKind {
        #[serde(rename = "buy")]
        Buy,
        #[serde(rename = "sell")]
        Sell,
    }

    #[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
    pub struct OfiSignificantEvent {
        #[serde(rename = "type")]
        pub kind: Option<OfiEventKind>,
        pub magnitude: f64,
    }

    /// Returns `Ok(None)` for the first snapshot (no previous book yet).
    pub fn ofi_book_calculate(
        core: &mut OfiBookCalculator,
        snapshot: &BookSnapshotIn,
    ) -> Result<Option<OfiDepth>, String> {
        let out = core.calculate(to_js(snapshot)?).map_err(jserr_to_string)?;
        if out.is_null() {
            Ok(None)
        } else {
            from_js(out).map(Some)
        }
    }

    pub fn ofi_moving_average(core: &OfiBookCalculator, window_size: u32) -> f64 {
        core.get_ofi_moving_average(window_size)
    }

    pub fn ofi_std_dev(core: &OfiBookCalculator, window_size: u32) -> f64 {
        core.get_ofi_std_dev(window_size)
    }

    pub fn ofi_significant_event(core: &OfiBookCalculator) -> OfiSignificantEvent {
        from_js(core.detect_significant_event()).unwrap_or(OfiSignificantEvent {
            kind: None,
            magnitude: 0.0,
        })
    }

    // ---------- Klines / dataset helpers ----------

    /// Bar duration in seconds for every supported Binance kline interval
    /// (mirrors `INTERVAL_SECONDS` in src/integrations/binance/klines.ts).
    pub fn interval_seconds(interval: &str) -> Option<f64> {
        Some(match interval {
            "1m" => 60.0,
            "3m" => 180.0,
            "5m" => 300.0,
            "15m" => 900.0,
            "30m" => 1_800.0,
            "1h" => 3_600.0,
            "2h" => 7_200.0,
            "4h" => 14_400.0,
            "6h" => 21_600.0,
            "12h" => 43_200.0,
            "1d" => 86_400.0,
            "3d" => 259_200.0,
            "1w" => 604_800.0,
            "1M" => 2_592_000.0,
            _ => return None,
        })
    }

    /// Intervals offered by the Strategy Lab picker — '1M' excluded, matching
    /// the TS picker (months vary 28–31 days so gap detection cannot drive a
    /// fixed paging cursor).
    pub const BACKTEST_TIMEFRAMES: [&str; 13] = [
        "1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "12h", "1d", "3d", "1w",
    ];

    /// Parse raw Binance REST kline rows into candles, dropping malformed rows
    /// and still-open candles. Never fails; bad input yields an empty vec.
    pub fn parse_klines(
        rows: &[serde_json::Value],
        interval_seconds: f64,
        now_ms: f64,
    ) -> Vec<Candle> {
        let Ok(js) = to_js(&rows.to_vec()) else {
            return Vec::new();
        };
        match super::parse_klines(js, interval_seconds, now_ms) {
            Ok(out) => from_js(out).unwrap_or_default(),
            Err(_) => Vec::new(),
        }
    }

    /// FNV-1a content checksum over the canonical candle row encoding —
    /// mirrors `checksumCandles` in src/backtest/fixture.ts.
    pub fn checksum_candles(candles: &[Candle]) -> String {
        let mut hash: u32 = 2_166_136_261;
        for c in candles {
            let row = format!(
                "{}|{}|{}|{}|{}|{}",
                js_num_to_string(c.time),
                js_num_to_string(c.open),
                js_num_to_string(c.high),
                js_num_to_string(c.low),
                js_num_to_string(c.close),
                js_num_to_string(c.volume),
            );
            for b in row.bytes() {
                hash ^= b as u32;
                hash = hash.wrapping_mul(16_777_619);
            }
        }
        format!("fnv1a-{:08x}", hash)
    }

    #[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct GapReport {
        pub gap_count: u64,
        pub longest_gap_bars: u64,
        pub missing_bars: u64,
    }

    /// Detect missing bars between consecutive candles (tolerance 5s),
    /// mirroring `detectGaps` in src/integrations/binance/klines.ts.
    pub fn detect_gaps(candles: &[Candle], interval_seconds: f64) -> GapReport {
        let Ok(js) = candles_js(candles) else {
            return GapReport::default();
        };
        match super::detect_gaps(js, interval_seconds, Some(5.0)) {
            Ok(out) => from_js(out).unwrap_or_default(),
            Err(_) => GapReport::default(),
        }
    }

    /// Build dataset provenance for a REST-fetched candle set. Computes the
    /// FNV-1a checksum internally (the TS version receives it precomputed).
    pub fn build_dataset_meta(
        candles: &[Candle],
        symbol: &str,
        interval: &str,
        fetched_at: f64,
    ) -> Option<BacktestDataset> {
        let interval_seconds = interval_seconds(interval)?;
        let checksum = checksum_candles(candles);
        let js = candles_js(candles).ok()?;
        let out =
            super::build_dataset_meta(js, symbol, interval, interval_seconds, fetched_at, &checksum)
                .ok()?;
        from_js(out).ok()
    }

    // ---------- Backtest engine (backtest-v1) ----------

    #[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
    pub enum DatasetSource {
        #[serde(rename = "SYNTHETIC_FIXTURE")]
        SyntheticFixture,
        #[serde(rename = "BINANCE_REST")]
        BinanceRest,
    }

    #[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct BacktestConfig {
        pub initial_capital: f64,
        pub fast_period: f64,
        pub slow_period: f64,
        pub fee_bps: f64,
        pub slippage_bps: f64,
    }

    impl Default for BacktestConfig {
        fn default() -> Self {
            Self {
                initial_capital: 10_000.0,
                fast_period: 12.0,
                slow_period: 36.0,
                fee_bps: 10.0,
                slippage_bps: 5.0,
            }
        }
    }

    #[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct BacktestDataset {
        pub id: String,
        pub name: String,
        pub symbol: String,
        pub interval: String,
        pub source: DatasetSource,
        pub checksum: String,
        pub candle_count: usize,
        pub start_time: f64,
        pub end_time: f64,
        pub interval_seconds: f64,
        pub fetched_at: f64,
    }

    #[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
    pub enum ExitReason {
        #[serde(rename = "SIGNAL")]
        Signal,
        #[serde(rename = "END_OF_DATA")]
        EndOfData,
    }

    #[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
    pub enum TradeSide {
        #[serde(rename = "LONG")]
        Long,
    }

    #[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct BacktestTrade {
        pub id: String,
        pub side: TradeSide,
        pub entry_time: f64,
        pub exit_time: f64,
        pub entry_price: f64,
        pub exit_price: f64,
        pub quantity: f64,
        pub entry_fee: f64,
        pub exit_fee: f64,
        pub gross_pnl: f64,
        pub net_pnl: f64,
        pub return_pct: f64,
        pub bars_held: i64,
        pub exit_reason: ExitReason,
    }

    #[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct BacktestEquityPoint {
        pub time: f64,
        pub equity: f64,
        pub drawdown_pct: f64,
        pub position_quantity: f64,
    }

    #[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct BacktestMetrics {
        pub initial_capital: f64,
        pub final_equity: f64,
        pub total_return_pct: f64,
        pub max_drawdown_pct: f64,
        pub total_trades: usize,
        pub win_rate_pct: f64,
        pub profit_factor: Option<f64>,
        pub sharpe_ratio: f64,
        pub total_fees: f64,
        pub exposure_pct: f64,
    }

    #[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct BacktestDiagnostics {
        pub deterministic: bool,
        pub execution_timing: String,
        pub price_model: String,
        pub warnings: Vec<String>,
    }

    #[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct BacktestResult {
        pub contract_version: String,
        pub engine: String,
        pub strategy: String,
        pub dataset: BacktestDataset,
        pub config: BacktestConfig,
        pub metrics: BacktestMetrics,
        pub trades: Vec<BacktestTrade>,
        pub equity_curve: Vec<BacktestEquityPoint>,
        pub diagnostics: BacktestDiagnostics,
    }

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct ComputedBacktest {
        metrics: BacktestMetrics,
        trades: Vec<BacktestTrade>,
        equity_curve: Vec<BacktestEquityPoint>,
    }

    /// Typed mirror of `validate_backtest_input` — identical checks and
    /// messages, operating on the typed config/dataset instead of JsValues.
    fn validate_backtest_typed(
        candles: &[Candle],
        dataset: &BacktestDataset,
        config: &BacktestConfig,
    ) -> Result<(), String> {
        if !config.initial_capital.is_finite() || config.initial_capital <= 0.0 {
            return Err("Initial capital must be a finite number greater than zero".to_string());
        }
        if !dataset.interval_seconds.is_finite() || dataset.interval_seconds <= 0.0 {
            return Err("Interval seconds must be finite and positive".to_string());
        }
        let is_integer = |v: f64| v.is_finite() && v.fract() == 0.0;
        if !is_integer(config.fast_period) || config.fast_period < 2.0 {
            return Err("Fast period must be an integer of at least 2".to_string());
        }
        if !is_integer(config.slow_period) || config.slow_period <= config.fast_period {
            return Err("Slow period must be an integer greater than the fast period".to_string());
        }
        if !config.fee_bps.is_finite() || !(0.0..=1_000.0).contains(&config.fee_bps) {
            return Err("Fee must be between 0 and 1,000 basis points".to_string());
        }
        if !config.slippage_bps.is_finite() || !(0.0..=1_000.0).contains(&config.slippage_bps) {
            return Err("Slippage must be between 0 and 1,000 basis points".to_string());
        }
        if (candles.len() as f64) < config.slow_period + 2.0 {
            return Err(format!(
                "At least {} candles are required",
                js_num_to_string(config.slow_period + 2.0)
            ));
        }
        for (index, candle) in candles.iter().enumerate() {
            let values = [
                candle.time,
                candle.open,
                candle.high,
                candle.low,
                candle.close,
                candle.volume,
            ];
            if values.iter().any(|v| !v.is_finite()) {
                return Err(format!("Candle {} contains a non-finite value", index));
            }
            if candle.open <= 0.0
                || candle.high <= 0.0
                || candle.low <= 0.0
                || candle.close <= 0.0
                || candle.volume < 0.0
            {
                return Err(format!("Candle {} contains an invalid market value", index));
            }
            if candle.high < candle.open.max(candle.close)
                || candle.low > candle.open.min(candle.close)
                || candle.low > candle.high
            {
                return Err(format!("Candle {} has inconsistent OHLC bounds", index));
            }
            if index > 0 && candle.time <= candles[index - 1].time {
                return Err("Candle timestamps must be strictly increasing".to_string());
            }
        }
        Ok(())
    }

    /// Run the `backtest-v1` SMA crossover engine. Mirrors
    /// `runSmaCrossBacktest` in src/backtest/engine.ts; returns `Err` with the
    /// same message the JS validator would throw.
    pub fn run_backtest(
        candles: &[Candle],
        dataset: &BacktestDataset,
        config: &BacktestConfig,
    ) -> Result<BacktestResult, String> {
        validate_backtest_typed(candles, dataset, config)?;
        let validated = ValidatedBacktest {
            candles: candles.to_vec(),
            initial_capital: config.initial_capital,
            fast_period: config.fast_period as usize,
            slow_period: config.slow_period as usize,
            fee_bps: config.fee_bps,
            slippage_bps: config.slippage_bps,
            interval_seconds: dataset.interval_seconds,
        };
        let computed = run_validated(&validated);
        let parts: ComputedBacktest = serde_json::from_value(computed)
            .map_err(|e| format!("backtest result decode failed: {e}"))?;

        let mut warnings: Vec<String> = Vec::new();
        if dataset.source == DatasetSource::SyntheticFixture {
            warnings.push(
                "Synthetic validation data is not evidence of live strategy performance."
                    .to_string(),
            );
        }
        warnings.push("This first slice models long/flat market orders only.".to_string());
        if dataset.source == DatasetSource::BinanceRest {
            warnings.push(
                "Real market data may contain exchange outage gaps; listed-pair history carries survivorship bias."
                    .to_string(),
            );
        }

        Ok(BacktestResult {
            contract_version: "backtest-v1".to_string(),
            engine: "RUST_WASM".to_string(),
            strategy: "SMA_CROSS_LONG_FLAT".to_string(),
            dataset: dataset.clone(),
            config: *config,
            metrics: parts.metrics,
            trades: parts.trades,
            equity_curve: parts.equity_curve,
            diagnostics: BacktestDiagnostics {
                deterministic: true,
                execution_timing: "NEXT_BAR_OPEN".to_string(),
                price_model: "MARKET_WITH_BPS_COSTS".to_string(),
                warnings,
            },
        })
    }

    /// Deterministic synthetic BTC fixture — mirrors
    /// `createSyntheticBtcFixture` in src/backtest/fixture.ts.
    #[derive(Clone, Debug, PartialEq)]
    pub struct BacktestFixture {
        pub candles: Vec<Candle>,
        pub dataset: BacktestDataset,
    }

    const FIXTURE_START_TIME: f64 = 1_704_067_200.0;
    const FIXTURE_CANDLE_COUNT: usize = 480;

    fn round_digits(value: f64, digits: i32) -> f64 {
        let factor = 10f64.powi(digits);
        js_round(value * factor) / factor
    }

    fn regime_level(index: usize) -> f64 {
        if index < 120 {
            42_000.0 + (index as f64 * 18.0)
        } else if index < 240 {
            44_160.0 - ((index - 120) as f64 * 24.0)
        } else if index < 360 {
            41_280.0 + ((index - 240) as f64 * 20.0)
        } else {
            43_680.0 - ((index - 360) as f64 * 10.0)
        }
    }

    pub fn synthetic_fixture() -> BacktestFixture {
        let mut candles: Vec<Candle> = Vec::with_capacity(FIXTURE_CANDLE_COUNT);
        let mut previous_close = 42_000.0f64;

        for index in 0..FIXTURE_CANDLE_COUNT {
            let idx = index as f64;
            let close = round_digits(
                regime_level(index) + (idx / 7.0).sin() * 110.0 + (idx / 19.0).sin() * 60.0,
                2,
            );
            let open = previous_close;
            let high = round_digits(open.max(close) + 20.0 + (index % 11) as f64, 2);
            let low = round_digits(open.min(close) - 18.0 - (index % 7) as f64, 2);
            let volume = round_digits(
                20.0 + (index % 17) as f64 + ((idx / 8.0).sin().abs()) * 12.0,
                4,
            );
            candles.push(Candle {
                time: FIXTURE_START_TIME + idx * 60.0,
                open,
                high,
                low,
                close,
                volume,
            });
            previous_close = close;
        }

        let first = candles[0];
        let last = candles[candles.len() - 1];
        let dataset = BacktestDataset {
            id: "btc-synthetic-regimes-v1".to_string(),
            name: "BTC/USDT deterministic regime fixture".to_string(),
            symbol: "BTCUSDT".to_string(),
            interval: "1m".to_string(),
            source: DatasetSource::SyntheticFixture,
            checksum: checksum_candles(&candles),
            candle_count: candles.len(),
            start_time: first.time,
            end_time: last.time,
            interval_seconds: 60.0,
            fetched_at: 0.0,
        };

        BacktestFixture { candles, dataset }
    }

    // ---------- UTC time formatting (mirrors the TS format helpers) ----------

    fn p2(v: u32) -> String {
        format!("{:02}", v)
    }

    /// `new Date(secs*1000).toISOString().replace('T',' ').slice(0,16)` —
    /// "YYYY-MM-DD HH:MM" in UTC.
    pub fn format_utc_minute(unix_seconds: f64) -> String {
        let (y, mo, d, hh, mi, _) = super::utc_parts(unix_seconds * 1000.0);
        format!("{}-{}-{} {}:{}", y, p2(mo), p2(d), p2(hh), p2(mi))
    }

    /// `toISOString().slice(11,16)` — "HH:MM" in UTC.
    pub fn format_utc_hm(unix_seconds: f64) -> String {
        let (_, _, _, hh, mi, _) = super::utc_parts(unix_seconds * 1000.0);
        format!("{}:{}", p2(hh), p2(mi))
    }

    /// "HH:MM:SS" in UTC (fallback for `format_local_time` off-wasm).
    pub fn format_utc_hms(unix_ms: f64) -> String {
        let (_, _, _, hh, mi, _) = super::utc_parts(unix_ms);
        let secs = (unix_ms / 1000.0).floor() as i64;
        let ss = secs.rem_euclid(60) as u32;
        format!("{}:{}:{}", p2(hh), p2(mi), p2(ss))
    }

    /// `new Date(ms).toLocaleTimeString()` approximation — browser-local
    /// HH:MM:SS on wasm, UTC HH:MM:SS elsewhere.
    pub fn format_local_time(unix_ms: f64) -> String {
        #[cfg(target_arch = "wasm32")]
        {
            let d = js_sys::Date::new(&JsValue::from_f64(unix_ms));
            return format!(
                "{}:{}:{}",
                p2(d.get_hours() as u32),
                p2(d.get_minutes() as u32),
                p2(d.get_seconds() as u32)
            );
        }
        #[cfg(not(target_arch = "wasm32"))]
        {
            format_utc_hms(unix_ms)
        }
    }
}
