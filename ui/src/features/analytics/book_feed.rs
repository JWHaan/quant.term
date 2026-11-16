//! Live top-20 Binance order-book snapshots — port of
//! `src/hooks/useOrderBook.ts` (`<symbol>@depth20@100ms`). Includes the same
//! telemetry (`depth` connection owner, `binance` market events) and the same
//! reconnect/watchdog policy. Parsing is defensive: malformed payloads are
//! dropped, never panics.

use std::cell::RefCell;
use std::rc::{Rc, Weak};

use leptos::prelude::*;
use serde_json::Value;
use wasm_bindgen::closure::Closure;
use wasm_bindgen::JsCast;
use web_sys::{window, Event, MessageEvent, WebSocket};

use crate::services::rest::IntervalGuard;
use crate::services::telemetry::{
    next_owner_id, record_live_market_event, release_live_connection, report_live_connection,
};
use crate::stores::{now_ms, use_stores, AppStores, ConnectionStatus, BINANCE_WS_URL};

const MAX_RECONNECT_DELAY_MS: f64 = 30_000.0;
const STALE_AFTER_MS: f64 = 10_000.0;
const WATCHDOG_MS: f64 = 1_000.0;

/// (price, quantity) string pairs, exactly as Binance sends them — the
/// quant-core OFI calculator parses the strings itself.
pub type BookLevel = (String, String);

#[derive(Clone, Debug, Default)]
pub struct BookSnapshot {
    pub bids: Vec<BookLevel>,
    pub asks: Vec<BookLevel>,
    /// Receive time (ms) — stands in for the TS `Date.now()` snapshot timestamp.
    pub timestamp: f64,
}

#[derive(Clone, Copy)]
pub struct OrderBookSignals {
    pub book: RwSignal<Option<BookSnapshot>>,
    pub connected: RwSignal<bool>,
}

/// `useOrderBook(symbol)` — returns reactive book + connection signals and
/// keeps the socket alive for the caller's lifetime. The feed lives in an
/// effect-owned slot; dropping it (symbol change / unmount) closes the socket.
pub fn use_order_book(symbol: Memo<String>) -> OrderBookSignals {
    let book = RwSignal::new(None::<BookSnapshot>);
    let connected = RwSignal::new(false);
    let slot = Rc::new(RefCell::new(None::<Rc<RefCell<OrderBookFeed>>>));
    let stores = use_stores();

    Effect::new(move |_| {
        let sym = symbol.get();
        // Replacing the slot drops the previous feed (RAII cleanup).
        *slot.borrow_mut() = if sym.is_empty() {
            None
        } else {
            Some(OrderBookFeed::start(sym, stores, book, connected))
        };
    });

    OrderBookSignals { book, connected }
}

fn is_order_book_level(v: &Value) -> bool {
    v.as_array()
        .map(|a| a.len() >= 2 && a[0].is_string() && a[1].is_string())
        .unwrap_or(false)
}

/// Mirrors `isDepthSnapshot`: bids/asks arrays of string pairs; optional
/// numeric event time `E`.
fn parse_depth_snapshot(
    data: &Value,
) -> Option<(Vec<BookLevel>, Vec<BookLevel>, Option<f64>)> {
    let obj = data.as_object()?;
    let bids_v = obj.get("bids")?.as_array()?;
    let asks_v = obj.get("asks")?.as_array()?;
    if !bids_v.iter().all(is_order_book_level) || !asks_v.iter().all(is_order_book_level) {
        return None;
    }
    let parse_levels = |rows: &[Value]| -> Vec<BookLevel> {
        rows.iter()
            .map(|r| {
                let a = r.as_array().map(Vec::as_slice).unwrap_or(&[]);
                (
                    a[0].as_str().unwrap_or_default().to_string(),
                    a[1].as_str().unwrap_or_default().to_string(),
                )
            })
            .collect()
    };
    let e = obj.get("E").and_then(|v| v.as_f64()).filter(|v| v.is_finite());
    Some((parse_levels(bids_v), parse_levels(asks_v), e))
}

/// One-shot `setTimeout` handle used for reconnect backoff. The closure is
/// stored separately on the feed (`reconnect_cb`) so the timer callback never
/// drops the `Closure` that is currently executing (wasm-bindgen hazard).
struct TimeoutSlot {
    id: i32,
}

impl TimeoutSlot {
    /// Arm a one-shot timeout around an already-built closure.
    fn from_closure(cb: &Closure<dyn FnMut(Event)>, ms: f64) -> Self {
        let id = window()
            .and_then(|w| {
                w.set_timeout_with_callback_and_timeout_and_arguments_0(
                    cb.as_ref().unchecked_ref(),
                    ms.max(0.0) as i32,
                )
                .ok()
            })
            .unwrap_or(0);
        Self { id }
    }
}

impl Drop for TimeoutSlot {
    fn drop(&mut self) {
        if self.id != 0 {
            if let Some(w) = window() {
                w.clear_timeout_with_handle(self.id);
            }
        }
    }
}

/// RAII owner of one order-book socket + its watchdog — the per-symbol feed
/// object the TS effect creates and destroys.
pub struct OrderBookFeed {
    this: Weak<RefCell<Self>>,
    symbol: String,
    ws: Option<WebSocket>,
    reconnect_attempts: u32,
    last_message_at: f64,
    disposed: bool,
    watchdog: Option<IntervalGuard>,
    reconnect_timer: Option<TimeoutSlot>,
    reconnect_cb: Option<Closure<dyn FnMut(Event)>>,
    on_open: Option<Closure<dyn FnMut(Event)>>,
    on_message: Option<Closure<dyn FnMut(MessageEvent)>>,
    on_error: Option<Closure<dyn FnMut(Event)>>,
    on_close: Option<Closure<dyn FnMut(Event)>>,
    stores: AppStores,
    book: RwSignal<Option<BookSnapshot>>,
    connected: RwSignal<bool>,
    owner_id: usize,
}

impl OrderBookFeed {
    fn start(
        symbol: String,
        stores: AppStores,
        book: RwSignal<Option<BookSnapshot>>,
        connected: RwSignal<bool>,
    ) -> Rc<RefCell<Self>> {
        let normalized = symbol.to_uppercase();
        let owner_id = next_owner_id();
        let feed = Rc::new(RefCell::new(Self {
            this: Weak::new(),
            symbol: normalized,
            ws: None,
            reconnect_attempts: 0,
            last_message_at: 0.0,
            disposed: false,
            watchdog: None,
            reconnect_timer: None,
            reconnect_cb: None,
            on_open: None,
            on_message: None,
            on_error: None,
            on_close: None,
            stores,
            book,
            connected,
            owner_id,
        }));
        feed.borrow_mut().this = Rc::downgrade(&feed);
        feed.borrow_mut().start_watchdog();
        feed.borrow_mut().connect();
        feed
    }

    fn report(&self, status: ConnectionStatus) {
        report_live_connection(&self.stores, "depth", self.owner_id, Some(status));
    }

    fn start_watchdog(&mut self) {
        let weak = self.this.clone();
        self.watchdog = Some(IntervalGuard::start(WATCHDOG_MS, move |_: Event| {
            let Some(cell) = weak.upgrade() else { return };
            let f = cell.borrow();
            if f.disposed {
                return;
            }
            if let Some(ws) = &f.ws {
                if ws.ready_state() == WebSocket::OPEN
                    && f.last_message_at > 0.0
                    && now_ms() - f.last_message_at > STALE_AFTER_MS
                {
                    ws.close();
                }
            }
        }));
    }

    fn schedule_reconnect(&mut self) {
        if self.disposed || self.reconnect_timer.is_some() {
            return;
        }
        let delay =
            (1_000.0 * 2f64.powi(self.reconnect_attempts as i32)).min(MAX_RECONNECT_DELAY_MS);
        self.reconnect_attempts += 1;
        self.report(ConnectionStatus::Reconnecting);

        let weak = self.this.clone();
        let cb = Closure::<dyn FnMut(Event)>::new(move |_: Event| {
            if let Some(cell) = weak.upgrade() {
                let mut f = cell.borrow_mut();
                f.reconnect_timer = None;
                f.connect();
            }
        });
        self.reconnect_timer = Some(TimeoutSlot::from_closure(&cb, delay));
        self.reconnect_cb = Some(cb);
    }

    fn connect(&mut self) {
        if self.disposed {
            return;
        }
        self.report(if self.reconnect_attempts > 0 {
            ConnectionStatus::Reconnecting
        } else {
            ConnectionStatus::Connecting
        });

        let url = format!(
            "{BINANCE_WS_URL}/ws/{}@depth20@100ms",
            self.symbol.to_lowercase()
        );
        let ws = match WebSocket::new(&url) {
            Ok(ws) => ws,
            Err(_) => {
                self.schedule_reconnect();
                return;
            }
        };
        self.ws = Some(ws.clone());

        let weak = self.this.clone();
        let on_open = Closure::<dyn FnMut(Event)>::new(move |_: Event| {
            let Some(cell) = weak.upgrade() else { return };
            let mut f = cell.borrow_mut();
            if f.ws.is_none() {
                return;
            }
            f.reconnect_attempts = 0;
            f.last_message_at = now_ms();
            f.connected.set(true);
            f.report(ConnectionStatus::Connected);
        });
        ws.set_onopen(Some(on_open.as_ref().unchecked_ref()));
        self.on_open = Some(on_open);

        let weak = self.this.clone();
        let on_message = Closure::<dyn FnMut(MessageEvent)>::new(move |ev: MessageEvent| {
            let Some(text) = ev.data().as_string() else { return };
            let Some(cell) = weak.upgrade() else { return };
            let mut f = cell.borrow_mut();
            let Ok(data) = serde_json::from_str::<Value>(&text) else {
                return;
            };
            let Some((bids, asks, e)) = parse_depth_snapshot(&data) else {
                return;
            };
            f.last_message_at = now_ms();
            f.book.set(Some(BookSnapshot {
                bids,
                asks,
                timestamp: f.last_message_at,
            }));
            record_live_market_event("binance", e, &f.symbol);
        });
        ws.set_onmessage(Some(on_message.as_ref().unchecked_ref()));
        self.on_message = Some(on_message);

        let weak = self.this.clone();
        let on_error = Closure::<dyn FnMut(Event)>::new(move |_: Event| {
            let Some(cell) = weak.upgrade() else { return };
            let f = cell.borrow_mut();
            if f.ws.is_none() {
                return;
            }
            f.connected.set(false);
            f.report(ConnectionStatus::Error);
            if let Some(ws) = f.ws.clone() {
                ws.close();
            }
        });
        ws.set_onerror(Some(on_error.as_ref().unchecked_ref()));
        self.on_error = Some(on_error);

        let weak = self.this.clone();
        let on_close = Closure::<dyn FnMut(Event)>::new(move |_: Event| {
            let Some(cell) = weak.upgrade() else { return };
            let mut f = cell.borrow_mut();
            if f.ws.is_none() {
                return;
            }
            f.ws = None;
            // Keep the handler closures alive: dropping a `Closure` inside its
            // own invocation is unsound. They are replaced on the next
            // `connect()` or dropped with the feed.
            f.connected.set(false);
            f.schedule_reconnect();
        });
        ws.set_onclose(Some(on_close.as_ref().unchecked_ref()));
        self.on_close = Some(on_close);
    }
}

impl Drop for OrderBookFeed {
    fn drop(&mut self) {
        self.disposed = true;
        self.reconnect_timer = None;
        self.reconnect_cb = None;
        if let Some(watchdog) = self.watchdog.take() {
            drop(watchdog);
        }
        if let Some(ws) = self.ws.take() {
            ws.set_onopen(None);
            ws.set_onmessage(None);
            ws.set_onerror(None);
            ws.set_onclose(None);
            let state = ws.ready_state();
            if state == WebSocket::OPEN || state == WebSocket::CONNECTING {
                ws.close();
            }
        }
        release_live_connection(&self.stores, self.owner_id);
    }
}
