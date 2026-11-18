//! Port of `src/features/market/OrderBookDOM.tsx` + `src/hooks/useOrderBook.ts`.
//! Live top-20 Binance `depth20@100ms` snapshots rendered as a DOM ladder.

use leptos::prelude::*;
use serde_json::Value;
use std::cell::RefCell;
use std::rc::Rc;

use super::{adaptive_book_step, format_aggregation_step, format_book_size, format_price, WsFeed, WsHandlers};
use crate::services::telemetry::{
    next_owner_id, record_live_market_event, release_live_connection, report_live_connection,
};
use crate::stores::{use_stores, ConnectionStatus, BINANCE_WS_URL};

const STALE_AFTER_MS: f64 = 10_000.0;
const DEPTH: usize = 50;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Side {
    Bid,
    Ask,
}

#[derive(Clone, PartialEq)]
struct OrderBookRow {
    price: f64,
    vol: f64,
    side: Side,
}

/// `(price, size)` levels: bids descending (best first), asks ascending.
#[derive(Clone, Copy)]
struct DepthSignals {
    bids: RwSignal<Vec<(f64, f64)>>,
    asks: RwSignal<Vec<(f64, f64)>>,
    connected: RwSignal<bool>,
}

/// Guard bundling the feed + telemetry owner so dropping releases 'depth'.
struct DepthSubscription {
    feed: WsFeed,
    owner_id: usize,
    stores: crate::stores::AppStores,
}

impl Drop for DepthSubscription {
    fn drop(&mut self) {
        release_live_connection(&self.stores, self.owner_id);
    }
}

/// `useOrderBook` — owns a `depth20@100ms` socket per symbol.
fn use_depth_book(symbol: Memo<String>) -> DepthSignals {
    let stores = use_stores();
    let bids = RwSignal::new(Vec::<(f64, f64)>::new());
    let asks = RwSignal::new(Vec::<(f64, f64)>::new());
    let connected = RwSignal::new(false);
    let slot = Rc::new(RefCell::new(None::<DepthSubscription>));

    Effect::new(move |_| {
        let sym = symbol.get();
        // Drop any previous subscription before the empty check / resubscribe.
        *slot.borrow_mut() = None;
        if sym.is_empty() {
            return;
        }
        let stream_sym = sym.to_lowercase();
        let owner_id = next_owner_id();
        let status = |s: ConnectionStatus| {
            report_live_connection(&stores, "depth", owner_id, Some(s));
        };

        bids.set(Vec::new());
        asks.set(Vec::new());
        connected.set(false);
        status(ConnectionStatus::Connecting);

        let bids_sig = bids;
        let asks_sig = asks;
        let sym_upper = sym.clone();
        let on_message: Rc<dyn Fn(&str)> = Rc::new(move |text| {
            let Ok(v) = serde_json::from_str::<Value>(text) else {
                return;
            };
            let Some(obj) = v.as_object() else { return };
            let parse_side = |key: &str, is_bid: bool| -> Vec<(f64, f64)> {
                let mut out = Vec::new();
                if let Some(arr) = obj.get(key).and_then(Value::as_array) {
                    for row in arr {
                        let Some(pair) = row.as_array() else { continue };
                        if pair.len() < 2 {
                            continue;
                        }
                        let p = js_to_number_local(pair.first());
                        let q = js_to_number_local(pair.get(1));
                        if p.is_finite() && q.is_finite() && p > 0.0 && q > 0.0 {
                            out.push((p, q));
                        }
                    }
                }
                out.sort_by(|a, b| {
                    if is_bid {
                        b.0.partial_cmp(&a.0)
                    } else {
                        a.0.partial_cmp(&b.0)
                    }
                    .unwrap_or(std::cmp::Ordering::Equal)
                });
                out.truncate(20);
                out
            };
            let nb = parse_side("bids", true);
            let na = parse_side("asks", false);
            if nb.is_empty() || na.is_empty() {
                return;
            }
            bids_sig.set(nb);
            asks_sig.set(na);
            let ts = js_to_number_local(obj.get("E"));
            let ts_opt = if ts.is_finite() { Some(ts) } else { None };
            record_live_market_event("binance", ts_opt, &sym_upper);
        });

        let mut handlers = WsHandlers::new(move |text| on_message(text));
        let st = stores;
        let owner = owner_id;
        handlers.on_open = Some(Rc::new(move || {
            connected.set(true);
            report_live_connection(&st, "depth", owner, Some(ConnectionStatus::Connected));
        }));
        handlers.on_close = Some(Rc::new({
            let st = stores;
            let owner = owner_id;
            move || {
                connected.set(false);
                report_live_connection(&st, "depth", owner, Some(ConnectionStatus::Disconnected));
            }
        }));
        handlers.on_reconnect = Some(Rc::new({
            let st = stores;
            let owner = owner_id;
            move || {
                connected.set(false);
                report_live_connection(&st, "depth", owner, Some(ConnectionStatus::Reconnecting));
            }
        }));
        handlers.on_error = Some(Rc::new({
            let st = stores;
            let owner = owner_id;
            move || {
                connected.set(false);
                report_live_connection(&st, "depth", owner, Some(ConnectionStatus::Error));
            }
        }));
        handlers.stale_after_ms = STALE_AFTER_MS;

        let url = format!("{BINANCE_WS_URL}/ws/{stream_sym}@depth20@100ms");
        let feed = WsFeed::start(&url, handlers);
        *slot.borrow_mut() = Some(DepthSubscription {
            feed,
            owner_id,
            stores,
        });
    });

    DepthSignals {
        bids,
        asks,
        connected,
    }
}

fn js_to_number_local(v: Option<&Value>) -> f64 {
    match v {
        Some(Value::Number(n)) => n.as_f64().unwrap_or(f64::NAN),
        Some(Value::String(s)) => s.trim().parse::<f64>().unwrap_or(f64::NAN),
        Some(Value::Bool(b)) => {
            if *b {
                1.0
            } else {
                0.0
            }
        }
        _ => f64::NAN,
    }
}

// ─── Component ───────────────────────────────────────────────────────────────

#[component]
pub fn OrderBookDOM(symbol: Option<Memo<String>>) -> impl IntoView {
    let symbol_memo = Memo::new(move |_| {
        symbol
            .map(|m| m.get().to_uppercase())
            .unwrap_or_else(|| "BTCUSDT".to_string())
    });
    let book = use_depth_book(symbol_memo);
    let bids_sig = book.bids;
    let asks_sig = book.asks;
    let connected_sig = book.connected;

    // TS keeps {symbol, level} so a symbol swap silently resets to RAW.
    // The stored symbol is only written on click (useState initial level is 0).
    let agg_state = RwSignal::new((String::new(), 0u8));
    let aggregation_level = Memo::new(move |_| {
        let sym = symbol_memo.get();
        let (s, l) = agg_state.get();
        if s == sym {
            l
        } else {
            0
        }
    });

    let reference_price = Memo::new(move |_| {
        let best_bid = bids_sig.with(|b| b.first().map(|l| l.0)).unwrap_or(f64::NAN);
        let best_ask = asks_sig.with(|a| a.first().map(|l| l.0)).unwrap_or(f64::NAN);
        if best_bid.is_finite() && best_ask.is_finite() && best_bid > 0.0 && best_ask > 0.0 {
            (best_bid + best_ask) / 2.0
        } else if best_bid.is_finite() && best_bid > 0.0 {
            best_bid
        } else {
            best_ask
        }
    });
    let base_step = Memo::new(move |_| adaptive_book_step(reference_price.get()));

    let processed = Memo::new(move |_| {
        let bids = bids_sig.get();
        let asks = asks_sig.get();
        if bids.is_empty() || asks.is_empty() {
            return (Vec::<OrderBookRow>::new(), 0.0f64, 0.0f64);
        }
        let level = aggregation_level.get();
        let step = if level == 0 {
            None
        } else {
            Some(base_step.get() * 10f64.powi(level as i32 - 1))
        };

        let mut ask_rows: Vec<OrderBookRow> = Vec::new();
        let mut bid_rows: Vec<OrderBookRow> = Vec::new();

        if let Some(prec) = step {
            // Aggregated buckets.
            let agg = |levels: &[(f64, f64)], is_ask: bool| -> Vec<(f64, f64)> {
                let mut out: Vec<(f64, f64)> = Vec::new();
                for &(p, v) in levels {
                    let bucket = if is_ask {
                        (p / prec).ceil() * prec
                    } else {
                        (p / prec).floor() * prec
                    };
                    if let Some(e) = out.iter_mut().find(|e| e.0 == bucket) {
                        e.1 += v;
                    } else {
                        out.push((bucket, v));
                    }
                }
                out.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
                out
            };
            let agg_asks = agg(&asks, true);
            let agg_bids = agg(&bids, false);
            let start = agg_asks.len().saturating_sub(DEPTH);
            for (p, v) in &agg_asks[start..] {
                ask_rows.push(OrderBookRow { price: *p, vol: *v, side: Side::Ask });
            }
            for (p, v) in agg_bids.iter().take(DEPTH) {
                bid_rows.push(OrderBookRow { price: *p, vol: *v, side: Side::Bid });
            }
        } else {
            // Raw levels.
            for (p, v) in asks.iter().take(DEPTH).rev() {
                ask_rows.push(OrderBookRow { price: *p, vol: *v, side: Side::Ask });
            }
            for (p, v) in bids.iter().take(DEPTH) {
                bid_rows.push(OrderBookRow { price: *p, vol: *v, side: Side::Bid });
            }
        }

        let mut max_vol = 0.0f64;
        for r in ask_rows.iter().chain(bid_rows.iter()) {
            if r.vol > max_vol {
                max_vol = r.vol;
            }
        }
        let spread = match (ask_rows.last(), bid_rows.first()) {
            (Some(a), Some(b)) => a.price - b.price,
            _ => 0.0,
        };

        let mut rows = ask_rows;
        rows.extend(bid_rows);
        (rows, max_vol, spread)
    });

    let is_connected = Memo::new(move |_| connected_sig.get());
    let depth_levels = move || [0u8, 1, 2];

    view! {
        <div class="dom-ladder">
            <div class="dom-ladder__head">
                <div class="dom-ladder__controls">
                    <span class="dom-ladder__title">"> DOM_LADDER"</span>
                    <div class="dom-ladder__seg">
                        <For
                            each=depth_levels
                            key=|level| *level
                            children=move |level| {
                                let step = if level == 0 {
                                    None
                                } else {
                                    Some(base_step.get() * 10f64.powi(level as i32 - 1))
                                };
                                let label = match step {
                                    None => "RAW".to_string(),
                                    Some(s) => format_aggregation_step(s),
                                };
                                let sym = symbol_memo.get();
                                view! {
                                    <button
                                        class=move || if aggregation_level.get() == level { "is-active" } else { "" }
                                        on:click=move |_| agg_state.set((sym.clone(), level))
                                    >
                                        {label}
                                    </button>
                                }
                            }
                        />
                    </div>
                </div>
                <div class="dom-ladder__stats">
                    <span>
                        "SPREAD: "
                        <strong class="tnum">
                            {move || {
                                let spread = processed.with(|(_, _, s)| *s);
                                if spread > 0.0 { format_price(spread) } else { "—".to_string() }
                            }}
                        </strong>
                    </span>
                    <span
                        class=move || if is_connected.get() { "text-glow" } else { "" }
                        style:color=move || if is_connected.get() { "var(--accent-success)" } else { "var(--accent-danger)" }
                    >
                        {move || if is_connected.get() { "[LINK_OK]" } else { "[NO_LINK]" }}
                    </span>
                </div>
            </div>

            <div class="dom-ladder__cols">
                <div style="flex: 1; text-align: right; padding-right: 8px;">"BID_VOL"</div>
                <div style="width: 80px; text-align: center;">"PRICE"</div>
                <div style="flex: 1; text-align: left; padding-left: 8px;">"ASK_VOL"</div>
            </div>

            <div class="dom-ladder__body no-scrollbar" style="display: flex; flex-direction: column;">
                <For
                    each=move || processed.with(|(rows, _, _)| rows.clone())
                    key=|row| format!("{:?}-{}-{}", row.side, row.price, row.vol.to_bits())
                    children=move |row| {
                        let is_bid = row.side == Side::Bid;
                        let max_vol = processed.with(|(_, m, _)| *m);
                        let width = if max_vol > 0.0 { (row.vol / max_vol) * 100.0 } else { 0.0 };
                        let color = if is_bid { "var(--accent-success)" } else { "var(--accent-danger)" };
                        view! {
                            <div class="dom-row">
                                <div class="dom-side dom-side--bid">
                                    {is_bid.then(|| view! {
                                        <div
                                            class="dom-side__bar"
                                            style=format!("width:{width}%;background:{color};border-left:2px solid {color}")
                                        />
                                        <span class="dom-side__vol tnum">{format_book_size(row.vol)}</span>
                                    })}
                                </div>
                                <div class="dom-row__price" style:color=color>
                                    {format_price(row.price)}
                                </div>
                                <div class="dom-side dom-side--ask">
                                    {(!is_bid).then(|| view! {
                                        <div
                                            class="dom-side__bar"
                                            style=format!("width:{width}%;background:{color};border-right:2px solid {color}")
                                        />
                                        <span class="dom-side__vol tnum">{format_book_size(row.vol)}</span>
                                    })}
                                </div>
                            </div>
                        }
                    }
                />
                {move || {
                    if processed.with(|(rows, _, _)| rows.is_empty()) {
                        view! {
                            <div class="feed-init" style="text-align: center;">
                                "AWAITING_DATA_STREAM..."
                            </div>
                        }.into_any()
                    } else {
                        ().into_any()
                    }
                }}
            </div>
        </div>
    }
}
