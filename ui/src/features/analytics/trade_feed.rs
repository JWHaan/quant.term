//! Shared `@aggTrade` WebSocket feed — port of
//! `src/hooks/useAggTradeStream.ts`. One reconnecting socket per symbol is
//! shared by every analytics consumer; listeners register/deregister through
//! `subscribe_agg_trades`, which returns an RAII subscription.

use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;

use quant_core::typed::AggTrade;
use serde_json::Value;
use wasm_bindgen::closure::Closure;
use wasm_bindgen::JsCast;
use web_sys::{window, Event, MessageEvent, WebSocket};

use crate::stores::{now_ms, BINANCE_WS_URL};

const STALE_AFTER_MS: f64 = 15_000.0;
const MAX_RECONNECT_DELAY_MS: f64 = 30_000.0;
const WATCHDOG_MS: i32 = 1_000;

type TradeListener = Rc<RefCell<dyn FnMut(AggTrade)>>;
type StatusListener = Rc<RefCell<dyn FnMut(bool)>>;

struct SharedFeed {
    symbol: String,
    listeners: Vec<TradeListener>,
    status_listeners: Vec<StatusListener>,
    socket: Option<WebSocket>,
    reconnect_timer: Option<i32>,
    reconnect_attempts: u32,
    last_message_at: f64,
    watchdog: Option<i32>,
    reconnect_closure: Option<Closure<dyn FnMut(Event)>>,
    watchdog_closure: Option<Closure<dyn FnMut(Event)>>,
    on_open: Option<Closure<dyn FnMut(Event)>>,
    on_message: Option<Closure<dyn FnMut(MessageEvent)>>,
    on_error: Option<Closure<dyn FnMut(Event)>>,
    on_close: Option<Closure<dyn FnMut(Event)>>,
}

impl SharedFeed {
    fn new(symbol: String) -> Rc<RefCell<Self>> {
        let feed = Rc::new(RefCell::new(Self {
            symbol,
            listeners: Vec::new(),
            status_listeners: Vec::new(),
            socket: None,
            reconnect_timer: None,
            reconnect_attempts: 0,
            last_message_at: 0.0,
            watchdog: None,
            reconnect_closure: None,
            watchdog_closure: None,
            on_open: None,
            on_message: None,
            on_error: None,
            on_close: None,
        }));
        // The TS feed starts its 1s watchdog at creation.
        let weak = Rc::downgrade(&feed);
        let cb = Closure::<dyn FnMut(Event)>::new(move |_: Event| {
            let Some(feed) = weak.upgrade() else { return };
            feed.borrow_mut().watchdog_tick();
        });
        let id = window()
            .and_then(|w| {
                w.set_interval_with_callback_and_timeout_and_arguments_0(
                    cb.as_ref().unchecked_ref(),
                    WATCHDOG_MS,
                )
                .ok()
            })
            .unwrap_or(0);
        {
            let mut f = feed.borrow_mut();
            f.watchdog = (id != 0).then_some(id);
            f.watchdog_closure = Some(cb);
        }
        feed
    }

    fn is_registered(&self, feed: &Rc<RefCell<Self>>) -> bool {
        FEEDS.with(|feeds| {
            feeds
                .borrow()
                .get(&self.symbol)
                .map(|registered| Rc::ptr_eq(registered, feed))
                .unwrap_or(false)
        })
    }

    fn notify_status(&self, connected: bool) {
        for listener in self.status_listeners.clone() {
            listener.borrow_mut()(connected);
        }
    }

    fn handle_open(&mut self) {
        self.reconnect_attempts = 0;
        self.last_message_at = now_ms();
        self.notify_status(true);
    }

    /// `Number(x)` coercion for numeric fields that Binance may send as
    /// strings or booleans.
    fn js_number(v: &Value) -> Option<f64> {
        match v {
            Value::Number(n) => n.as_f64(),
            Value::String(s) => s.trim().parse::<f64>().ok(),
            Value::Bool(b) => Some(if *b { 1.0 } else { 0.0 }),
            _ => None,
        }
    }

    fn handle_message(&mut self, text: &str) {
        let Ok(data) = serde_json::from_str::<Value>(text) else {
            return;
        };
        let get = |key: &str| data.get(key).and_then(Self::js_number);
        let (Some(id), Some(price), Some(quantity), Some(timestamp)) = (
            get("a"),
            get("p"),
            get("q"),
            get("T"),
        ) else {
            return;
        };
        if ![id, price, quantity, timestamp].iter().all(|v| v.is_finite()) {
            return;
        }
        let is_buyer_maker = data.get("m").and_then(|v| v.as_bool()).unwrap_or(false);
        self.last_message_at = now_ms();
        let trade = AggTrade {
            id,
            price,
            quantity,
            timestamp,
            is_buyer_maker,
        };
        for listener in self.listeners.clone() {
            listener.borrow_mut()(trade);
        }
    }

    fn handle_close(&mut self, feed: &Rc<RefCell<Self>>) {
        if self.socket.is_none() {
            return;
        }
        self.socket = None;
        // Keep the handler closures alive: dropping a `Closure` inside its own
        // invocation is unsound. They are replaced on the next `connect()` or
        // dropped when the feed is torn down.
        self.notify_status(false);
        if self.listeners.is_empty() || !self.is_registered(feed) {
            return;
        }
        self.schedule_reconnect(feed);
    }

    fn schedule_reconnect(&mut self, feed: &Rc<RefCell<Self>>) {
        if self.reconnect_timer.is_some() {
            return;
        }
        let delay = (1_000.0 * 2f64.powi(self.reconnect_attempts as i32))
            .min(MAX_RECONNECT_DELAY_MS);
        self.reconnect_attempts += 1;
        let weak = Rc::downgrade(feed);
        let cb = Closure::<dyn FnMut(Event)>::new(move |_: Event| {
            if let Some(feed) = weak.upgrade() {
                {
                    let mut f = feed.borrow_mut();
                    f.reconnect_timer = None;
                }
                connect(&feed);
            }
        });
        let id = window()
            .and_then(|w| {
                w.set_timeout_with_callback_and_timeout_and_arguments_0(
                    cb.as_ref().unchecked_ref(),
                    delay as i32,
                )
                .ok()
            })
            .unwrap_or(0);
        self.reconnect_timer = (id != 0).then_some(id);
        self.reconnect_closure = Some(cb);
    }

    fn watchdog_tick(&mut self) {
        if let Some(ws) = &self.socket {
            if ws.ready_state() == WebSocket::OPEN
                && self.last_message_at > 0.0
                && now_ms() - self.last_message_at > STALE_AFTER_MS
            {
                ws.close();
            }
        }
    }

    fn connect(&mut self, feed: &Rc<RefCell<Self>>) {
        if !self.is_registered(feed)
            || self.listeners.is_empty()
            || self.socket.is_some()
        {
            return;
        }
        let url = format!(
            "{BINANCE_WS_URL}/ws/{}@aggTrade",
            self.symbol.to_lowercase()
        );
        let ws = match WebSocket::new(&url) {
            Ok(ws) => ws,
            Err(_) => {
                // WebSocket constructor throws on malformed URLs; treat like a
                // failed open and retry with backoff instead of panicking.
                self.schedule_reconnect(feed);
                return;
            }
        };
        self.socket = Some(ws.clone());

        let weak = Rc::downgrade(feed);
        let on_open = Closure::<dyn FnMut(Event)>::new(move |_: Event| {
            if let Some(feed) = weak.upgrade() {
                feed.borrow_mut().handle_open();
            }
        });
        ws.set_onopen(Some(on_open.as_ref().unchecked_ref()));
        self.on_open = Some(on_open);

        let weak = Rc::downgrade(feed);
        let on_message = Closure::<dyn FnMut(MessageEvent)>::new(move |ev: MessageEvent| {
            let Some(text) = ev.data().as_string() else { return };
            if let Some(feed) = weak.upgrade() {
                feed.borrow_mut().handle_message(&text);
            }
        });
        ws.set_onmessage(Some(on_message.as_ref().unchecked_ref()));
        self.on_message = Some(on_message);

        let weak = Rc::downgrade(feed);
        let on_error = Closure::<dyn FnMut(Event)>::new(move |_: Event| {
            if let Some(feed) = weak.upgrade() {
                if let Some(ws) = feed.borrow().socket.clone() {
                    ws.close();
                }
            }
        });
        ws.set_onerror(Some(on_error.as_ref().unchecked_ref()));
        self.on_error = Some(on_error);

        let weak = Rc::downgrade(feed);
        let on_close = Closure::<dyn FnMut(Event)>::new(move |_: Event| {
            if let Some(feed) = weak.upgrade() {
                feed.borrow_mut().handle_close(&feed);
            }
        });
        ws.set_onclose(Some(on_close.as_ref().unchecked_ref()));
        self.on_close = Some(on_close);
    }
}

fn connect(feed: &Rc<RefCell<SharedFeed>>) {
    feed.borrow_mut().connect(feed);
}

thread_local! {
    static FEEDS: RefCell<HashMap<String, Rc<RefCell<SharedFeed>>>> = RefCell::new(HashMap::new());
}

/// RAII handle for one subscription; dropping it removes the listeners and
/// tears the shared socket down once the last consumer leaves.
pub struct AggTradeSubscription {
    feed: Rc<RefCell<SharedFeed>>,
    listener: TradeListener,
    status_listener: StatusListener,
}

/// Subscribe to `symbol`'s aggregate-trade stream. `on_trade` receives parsed,
/// validated trades; `on_status` receives live/offline transitions.
pub fn subscribe_agg_trades(
    symbol: &str,
    on_trade: impl FnMut(AggTrade) + 'static,
    on_status: impl FnMut(bool) + 'static,
) -> AggTradeSubscription {
    let normalized = symbol.to_uppercase();
    let feed = FEEDS.with(|feeds| {
        let mut feeds = feeds.borrow_mut();
        if let Some(existing) = feeds.get(&normalized) {
            return existing.clone();
        }
        let feed = SharedFeed::new(normalized.clone());
        feeds.insert(normalized.clone(), feed.clone());
        feed
    });

    let listener: TradeListener = Rc::new(RefCell::new(on_trade));
    let status_listener: StatusListener = Rc::new(RefCell::new(on_status));
    {
        let mut f = feed.borrow_mut();
        f.listeners.push(listener.clone());
        f.status_listeners.push(status_listener.clone());
        let connected = f
            .socket
            .as_ref()
            .map(|s| s.ready_state() == WebSocket::OPEN)
            .unwrap_or(false);
        status_listener.borrow_mut()(connected);
    }
    connect(&feed);

    AggTradeSubscription {
        feed,
        listener,
        status_listener,
    }
}

impl Drop for AggTradeSubscription {
    fn drop(&mut self) {
        let feed = Rc::clone(&self.feed);
        let mut f = feed.borrow_mut();
        f.listeners
            .retain(|l| !Rc::ptr_eq(l, &self.listener));
        f.status_listeners
            .retain(|l| !Rc::ptr_eq(l, &self.status_listener));
        if !f.listeners.is_empty() {
            return;
        }

        // Last consumer: tear down timers + socket, unregister the feed.
        if let Some(id) = f.reconnect_timer.take() {
            if let Some(w) = window() {
                w.clear_timeout_with_handle(id);
            }
        }
        f.reconnect_closure = None;
        if let Some(id) = f.watchdog.take() {
            if let Some(w) = window() {
                w.clear_interval_with_handle(id);
            }
        }
        f.watchdog_closure = None;
        if let Some(ws) = f.socket.take() {
            ws.set_onopen(None);
            ws.set_onmessage(None);
            ws.set_onerror(None);
            ws.set_onclose(None);
            let state = ws.ready_state();
            if state == WebSocket::OPEN || state == WebSocket::CONNECTING {
                ws.close();
            }
        }
        f.on_open = None;
        f.on_message = None;
        f.on_error = None;
        f.on_close = None;
        drop(f);
        FEEDS.with(|feeds| {
            feeds.borrow_mut().remove(&self.feed.borrow().symbol);
        });
    }
}

