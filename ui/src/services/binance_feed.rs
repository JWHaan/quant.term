//! Binance combined-stream WebSocket feed — port of
//! `src/hooks/useBinanceWebSocket.ts`. Subscribes to `<symbol>@kline_<interval>`
//! and `<symbol>@depth20@100ms`, parses defensively, and drives the
//! connection/market signals plus telemetry/provenance side effects.

use std::cell::RefCell;
use std::rc::{Rc, Weak};

use leptos::prelude::*;
use serde_json::Value;
use wasm_bindgen::closure::Closure;
use wasm_bindgen::JsCast;
use web_sys::{window, Event, MessageEvent, WebSocket};

use crate::services::provenance::with_provenance_engine;
use crate::services::telemetry::{
    next_owner_id, record_live_market_event, release_live_connection, report_live_connection,
};
use crate::stores::{now_ms, use_stores, AppStores, ConnectionStatus, Ohlcv};

pub const BINANCE_WS_URL: &str = "wss://data-stream.binance.vision";

const MAX_RECONNECT_DELAY_MS: f64 = 30_000.0;
const STALE_BOOK_AFTER_MS: f64 = 2_000.0;
const STALE_SOCKET_AFTER_MS: f64 = 15_000.0;

#[derive(Clone, Copy, Debug)]
pub struct BookLevel {
    pub price: f64,
    pub size: f64,
    pub total: f64,
}

#[derive(Clone, Debug)]
pub struct LiveOrderBook {
    pub bids: Vec<BookLevel>,
    pub asks: Vec<BookLevel>,
    pub last_update_id: f64,
    pub timestamp: f64,
    pub is_stale: bool,
}

/// Reactive outputs of a feed instance — stable across reconnects and
/// symbol/interval changes (the hook recreates the feed, not the signals).
#[derive(Clone, Copy)]
pub struct FeedSignals {
    pub candle: RwSignal<Option<Ohlcv>>,
    pub order_book: RwSignal<Option<LiveOrderBook>>,
    pub is_connected: RwSignal<bool>,
    pub last_update: RwSignal<f64>,
    pub reconnect_count: RwSignal<u64>,
}

impl FeedSignals {
    pub fn new() -> Self {
        Self {
            candle: RwSignal::new(None),
            order_book: RwSignal::new(None),
            is_connected: RwSignal::new(false),
            last_update: RwSignal::new(0.0),
            reconnect_count: RwSignal::new(0),
        }
    }
}

struct Shared {
    this: Weak<RefCell<Shared>>,
    disposed: bool,
    reconnect_attempts: u32,
    has_opened: bool,
    last_message_at: f64,
    reconnect_timer: Option<i32>,
    watchdog_timer: Option<i32>,
    reconnect_closure: Option<Closure<dyn FnMut(Event)>>,
    watchdog_closure: Option<Closure<dyn FnMut(Event)>>,
    ws: Option<WebSocket>,
    owner_id: usize,
    on_open: Option<Closure<dyn FnMut(Event)>>,
    on_error: Option<Closure<dyn FnMut(Event)>>,
    on_close: Option<Closure<dyn FnMut(Event)>>,
    on_message: Option<Closure<dyn FnMut(MessageEvent)>>,
    stores: AppStores,
    signals: FeedSignals,
    normalized_symbol: String,
    stream_symbol: String,
    interval: String,
}

impl Shared {
    fn report_all(&self, status: ConnectionStatus) {
        for source in ["binance", "depth"] {
            report_live_connection(&self.stores, source, self.owner_id, Some(status));
        }
    }

    fn connect(&mut self) {
        if self.disposed {
            return;
        }
        self.report_all(if self.reconnected() {
            ConnectionStatus::Reconnecting
        } else {
            ConnectionStatus::Connecting
        });

        let streams = format!(
            "{0}@kline_{1}/{0}@depth20@100ms",
            self.stream_symbol, self.interval
        );
        let url = format!("{BINANCE_WS_URL}/stream?streams={streams}");
        let ws = match WebSocket::new(&url) {
            Ok(ws) => ws,
            Err(_) => {
                self.schedule_reconnect();
                return;
            }
        };

        let Some(rc) = self.this.upgrade() else { return };

        let on_open = Closure::wrap(Box::new(move |_: Event| {
            rc.borrow_mut().handle_open();
        }) as Box<dyn FnMut(Event)>);
        ws.set_onopen(Some(on_open.as_ref().unchecked_ref()));

        let Some(rc) = self.this.upgrade() else { return };
        let on_message = Closure::wrap(Box::new(move |event: MessageEvent| {
            if let Some(text) = event.data().as_string() {
                rc.borrow_mut().handle_message(&text);
            }
        }) as Box<dyn FnMut(MessageEvent)>);
        ws.set_onmessage(Some(on_message.as_ref().unchecked_ref()));

        let Some(rc) = self.this.upgrade() else { return };
        let on_error = Closure::wrap(Box::new(move |_: Event| {
            rc.borrow_mut().handle_error();
        }) as Box<dyn FnMut(Event)>);
        ws.set_onerror(Some(on_error.as_ref().unchecked_ref()));

        let Some(rc) = self.this.upgrade() else { return };
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

    fn reconnected(&self) -> bool {
        self.reconnect_attempts > 0
    }

    fn handle_open(&mut self) {
        if self.disposed {
            return;
        }
        self.last_message_at = now_ms();
        self.reconnect_attempts = 0;
        self.signals.is_connected.set(true);
        self.report_all(ConnectionStatus::Connected);

        if self.has_opened {
            let next = self.signals.reconnect_count.get() + 1;
            self.signals.reconnect_count.set(next);
        } else {
            self.has_opened = true;
            self.signals.reconnect_count.set(0);
        }
    }

    fn handle_message(&mut self, text: &str) {
        if self.disposed {
            return;
        }
        let parsed: Value = match serde_json::from_str(text) {
            Ok(v) => v,
            Err(e) => {
                web_sys::console::error_1(
                    &format!("[Binance] Failed to parse market message: {e}").into(),
                );
                return;
            }
        };
        let (stream, data) = extract_payload(&parsed);
        let Some(data) = data else { return };

        let received_at = now_ms();
        self.last_message_at = received_at;
        self.signals.last_update.set(received_at);

        let event_timestamp =
            as_finite_number(data.get("E")).or_else(|| as_finite_number(data.get("T")));
        record_live_market_event("binance", event_timestamp, &self.normalized_symbol);

        let is_kline = data.get("e").and_then(Value::as_str) == Some("kline")
            || stream.as_deref().is_some_and(|s| s.contains("@kline_"));
        if is_kline {
            let Some(kline) = data.get("k") else { return };
            let fields = ["t", "o", "h", "l", "c", "v"].map(|k| as_finite_number(kline.get(k)));
            if fields.iter().any(Option::is_none) {
                return;
            }
            let [time, open, high, low, close, volume] = fields.map(|v| v.unwrap_or(0.0));
            let candle = Ohlcv {
                time: time / 1000.0,
                open,
                high,
                low,
                close,
                volume,
            };
            self.signals.candle.set(Some(candle));
            with_provenance_engine(&self.normalized_symbol, |engine| {
                engine.augment(event_timestamp.unwrap_or(received_at));
            });
            return;
        }

        let is_partial_depth = stream.as_deref().is_some_and(|s| s.contains("@depth20"))
            || (data.get("bids").is_some_and(Value::is_array)
                && data.get("asks").is_some_and(Value::is_array));
        if is_partial_depth {
            let bids = parse_price_levels(data.get("bids"), true);
            let asks = parse_price_levels(data.get("asks"), false);
            if bids.is_empty() || asks.is_empty() {
                return;
            }
            self.signals.order_book.set(Some(LiveOrderBook {
                bids,
                asks,
                last_update_id: as_finite_number(data.get("lastUpdateId")).unwrap_or(0.0),
                timestamp: received_at,
                is_stale: false,
            }));
        }
    }

    fn handle_error(&mut self) {
        if self.disposed {
            return;
        }
        self.signals.is_connected.set(false);
        self.report_all(ConnectionStatus::Error);
        if let Some(ws) = &self.ws {
            let _ = ws.close();
        }
    }

    fn handle_close(&mut self) {
        if self.disposed {
            return;
        }
        self.signals.is_connected.set(false);
        if let Some(book) = self.signals.order_book.get() {
            if !book.is_stale {
                let mut stale = book.clone();
                stale.is_stale = true;
                self.signals.order_book.set(Some(stale));
            }
        }
        with_provenance_engine(&self.normalized_symbol, |engine| {
            engine.mark_disconnected();
        });
        self.schedule_reconnect();
    }

    fn schedule_reconnect(&mut self) {
        if self.disposed || self.reconnect_timer.is_some() {
            return;
        }
        let delay = MAX_RECONNECT_DELAY_MS.min(1_000.0 * 2f64.powi(self.reconnect_attempts as i32));
        self.reconnect_attempts += 1;
        self.report_all(ConnectionStatus::Reconnecting);

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
        // Keep the closure alive for the lifetime of the timer.
        self.reconnect_closure = Some(cb);
        self.reconnect_timer = Some(timer);
    }

    fn watchdog_tick(&mut self) {
        let now = now_ms();
        if let Some(book) = self.signals.order_book.get() {
            if !book.is_stale && now - book.timestamp > STALE_BOOK_AFTER_MS {
                let mut stale = book.clone();
                stale.is_stale = true;
                self.signals.order_book.set(Some(stale));
            }
        }

        let is_open = self
            .ws
            .as_ref()
            .is_some_and(|ws| ws.ready_state() == WebSocket::OPEN);
        if is_open
            && self.last_message_at > 0.0
            && now - self.last_message_at > STALE_SOCKET_AFTER_MS
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
        self.reconnect_closure = None;

        if let Some(ws) = self.ws.take() {
            ws.set_onopen(None);
            ws.set_onmessage(None);
            ws.set_onerror(None);
            ws.set_onclose(None);
            if ws.ready_state() == WebSocket::OPEN || ws.ready_state() == WebSocket::CONNECTING {
                let _ = ws.close();
            }
        }
        self.on_open = None;
        self.on_message = None;
        self.on_error = None;
        self.on_close = None;

        // Teardown (symbol/interval swap or unmount) is not a feed failure —
        // reset so a remounted feed reads CONNECTING until its first tick.
        with_provenance_engine(&self.normalized_symbol, |engine| {
            engine.reset();
        });
        release_live_connection(&self.stores, self.owner_id);
    }
}

/// RAII guard for a running feed. Dropping it disconnects and releases
/// telemetry ownership — mirrors the React effect cleanup.
pub struct BinanceFeed {
    shared: Rc<RefCell<Shared>>,
}

impl BinanceFeed {
    /// Start a feed for `symbol`/`interval`, writing into `signals`.
    /// Call inside a reactive owner (component or effect).
    pub fn start(symbol: &str, interval: &str, stores: AppStores, signals: FeedSignals) -> Self {
        let normalized_symbol = symbol.to_uppercase();
        let stream_symbol = normalized_symbol.to_lowercase();
        let owner_id = next_owner_id();

        signals.candle.set(None);
        signals.order_book.set(None);
        signals.is_connected.set(false);
        signals.last_update.set(0.0);
        signals.reconnect_count.set(0);

        let shared = Rc::new_cyclic(|this| {
            RefCell::new(Shared {
                this: this.clone(),
                disposed: false,
                reconnect_attempts: 0,
                has_opened: false,
                last_message_at: 0.0,
                reconnect_timer: None,
                watchdog_timer: None,
                reconnect_closure: None,
                watchdog_closure: None,
                ws: None,
                owner_id,
                on_open: None,
                on_error: None,
                on_close: None,
                on_message: None,
                stores,
                signals,
                normalized_symbol: normalized_symbol.clone(),
                stream_symbol,
                interval: interval.to_string(),
            })
        });

        shared.borrow_mut().connect();

        // 1s watchdog: stale book flagging + silent-socket reconnect.
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
            s.watchdog_closure = Some(cb);
        }

        Self { shared }
    }

    pub fn stop(&self) {
        self.shared.borrow_mut().dispose();
    }
}

impl Drop for BinanceFeed {
    fn drop(&mut self) {
        self.shared.borrow_mut().dispose();
    }
}

/// Leptos hook equivalent of `useBinanceWebSocket`. Watches `symbol` and
/// `interval` memos and restarts the feed when either changes.
pub fn use_binance_feed(symbol: Memo<String>, interval: Memo<String>) -> FeedSignals {
    let stores = use_stores();
    let signals = FeedSignals::new();
    let slot = Rc::new(RefCell::new(None::<BinanceFeed>));

    Effect::new(move |_| {
        let sym = symbol.get();
        let int = interval.get();
        let feed = BinanceFeed::start(&sym, &int, stores, signals);
        *slot.borrow_mut() = Some(feed);
    });

    // No explicit on_cleanup needed: `slot` is owned by the effect, which the
    // reactive owner drops on teardown — dropping the Option<BinanceFeed>
    // runs `dispose` via `Drop`.
    signals
}

// ---- payload parsing helpers (defensive, mirroring the TS coercion) ----

/// Combined streams wrap payloads in `{ stream, data }`; a raw object is
/// accepted as well for resilience to server-side subscription changes.
fn extract_payload(raw: &Value) -> (Option<String>, Option<&Value>) {
    let Some(obj) = raw.as_object() else {
        return (None, None);
    };
    let stream = obj
        .get("stream")
        .and_then(Value::as_str)
        .map(str::to_string);
    let data = obj.get("data").filter(|v| v.is_object()).unwrap_or(raw);
    (stream, Some(data))
}

/// `Number(value)` semantics: numbers pass through, strings parse, booleans
/// coerce to 1/0, everything else is rejected.
fn as_finite_number(value: Option<&Value>) -> Option<f64> {
    let parsed = match value? {
        Value::Number(n) => n.as_f64()?,
        Value::String(s) => s.trim().parse::<f64>().ok()?,
        Value::Bool(b) => {
            if *b {
                1.0
            } else {
                0.0
            }
        }
        _ => return None,
    };
    parsed.is_finite().then_some(parsed)
}

fn parse_price_levels(value: Option<&Value>, is_bid: bool) -> Vec<BookLevel> {
    let Some(rows) = value.and_then(Value::as_array) else {
        return Vec::new();
    };
    let mut levels: Vec<(f64, f64)> = Vec::new();
    for row in rows {
        let Some(pair) = row.as_array() else { continue };
        if pair.len() < 2 {
            continue;
        }
        let (Some(price), Some(size)) = (
            as_finite_number(pair.first()),
            as_finite_number(pair.get(1)),
        ) else {
            continue;
        };
        if price <= 0.0 || size <= 0.0 {
            continue;
        }
        levels.push((price, size));
    }
    levels.sort_by(|a, b| {
        if is_bid {
            b.0.partial_cmp(&a.0)
        } else {
            a.0.partial_cmp(&b.0)
        }
        .unwrap_or(std::cmp::Ordering::Equal)
    });

    let mut cumulative = 0.0;
    levels
        .into_iter()
        .take(20)
        .map(|(price, size)| {
            cumulative += size;
            BookLevel {
                price,
                size,
                total: cumulative,
            }
        })
        .collect()
}
