//! Port of `src/features/market/LiquidationFeed.tsx` — the "Rekt" tape.

use leptos::prelude::*;
use std::cell::RefCell;
use std::rc::Rc;

use super::{
    format_hms_local, format_liq_value, format_price, futures_contract,
    liquidation_ws_handlers, Liquidation, WsFeed, IconDroplets, IconTrendingDown, IconTrendingUp,
};
use crate::stores::{use_stores, BINANCE_FUTURES_WS_URL};

#[derive(Clone, Copy, PartialEq, Eq)]
enum LiqSide {
    Long,
    Short,
}

#[derive(Clone)]
#[allow(dead_code)] // amount/symbol mirror the TS Liquidation shape but aren't rendered
struct LiqRow {
    id: String,
    time: f64,
    side: LiqSide,
    price: f64,
    amount: f64,
    value: f64,
    symbol: String,
}

#[derive(Clone, Copy, Default)]
struct LiqStats {
    total_vol: f64,
    long_vol: f64,
    short_vol: f64,
}

/// Owns the WS subscription; dropping it disconnects (and reports
/// 'futures' -> disconnected like the TS `close()`).
struct LiqSubscription {
    feed: WsFeed,
    stores: crate::stores::AppStores,
}

impl Drop for LiqSubscription {
    fn drop(&mut self) {
        self.stores
            .set_connection_status("futures", crate::stores::ConnectionStatus::Disconnected);
    }
}

#[component]
pub fn LiquidationFeed(symbol: Option<Memo<String>>) -> impl IntoView {
    let stores = use_stores();
    let symbol_memo = Memo::new(move |_| {
        symbol
            .map(|m| m.get())
            .unwrap_or_else(|| "BTCUSDT".to_string())
    });
    let contract = Memo::new(move |_| futures_contract(&symbol_memo.get()));

    let liquidations = RwSignal::new(Vec::<LiqRow>::new());
    let stats = RwSignal::new(LiqStats::default());
    let slot = Rc::new(RefCell::new(None::<LiqSubscription>));

    Effect::new(move |_| {
        let c = contract.get();
        let fut_sym = c.futures_symbol.clone();
        let mult = c.multiplier;
        let spot = c.spot_symbol.clone();

        let liqs = liquidations;
        let st = stats;
        let on_liq: Rc<dyn Fn(Liquidation)> = Rc::new(move |liq| {
            if liq.symbol != fut_sym {
                return;
            }
            let price = liq.price / mult;
            let amount = liq.quantity * mult;
            // BUY order = short squeeze, SELL order = long liquidation.
            let side = if liq.is_buy { LiqSide::Short } else { LiqSide::Long };
            let side_label = match side {
                LiqSide::Long => "LONG",
                LiqSide::Short => "SHORT",
            };
            let row = LiqRow {
                id: format!("{}-{}-{}", liq.symbol, liq.time, side_label),
                time: liq.time,
                side,
                price,
                amount,
                value: liq.value,
                symbol: spot.clone(),
            };
            liqs.update(|list| {
                list.insert(0, row);
                list.truncate(50);
            });
            st.update(|s| {
                s.total_vol += liq.value;
                if liq.is_buy {
                    s.short_vol += liq.value;
                } else {
                    s.long_vol += liq.value;
                }
            });
        });

        let url = format!("{BINANCE_FUTURES_WS_URL}/!forceOrder@arr");
        let handlers = liquidation_ws_handlers(stores, on_liq);
        let feed = WsFeed::start(&url, handlers);
        *slot.borrow_mut() = Some(LiqSubscription { feed, stores });
    });

    let fut_symbol_label = Memo::new(move |_| contract.with(|c| c.futures_symbol.clone()));

    view! {
        <div class="tape">
            <div class="tape-stats">
                <div class="tape-stat" style="color: var(--accent-danger)">
                    <IconTrendingDown size=12/> " "
                    <span>{move || format!("SESSION LONG LIQS: {}", format_liq_value(stats.with(|s| s.long_vol)))}</span>
                </div>
                <div class="tape-stat" style="color: var(--accent-success)">
                    <IconTrendingUp size=12/> " "
                    <span>{move || format!("SESSION SHORT LIQS: {}", format_liq_value(stats.with(|s| s.short_vol)))}</span>
                </div>
            </div>

            <div class="tape-cols">
                <div>"TIME"</div>
                <div>"PRICE"</div>
                <div>"VAL"</div>
                <div>"TYPE"</div>
            </div>

            <div class="tape-body no-scrollbar">
                {move || {
                    let rows = liquidations.with(|l| l.clone());
                    if rows.is_empty() {
                        view! {
                            <div class="tape-empty">
                                <IconDroplets/>
                                <span>"SCANNING_FOR_LIQUIDATIONS..."</span>
                                <small>{format!("[TARGET: {} · !forceOrder@arr]", fut_symbol_label.get())}</small>
                            </div>
                        }.into_any()
                    } else {
                        rows.into_iter().map(|liq| {
                            let side_class = match liq.side {
                                LiqSide::Long => "long",
                                LiqSide::Short => "short",
                            };
                            let big = if liq.value > 10_000.0 { " tape-row--big" } else { "" };
                            let class = format!("tape-row tape-row--{side_class}{big}");
                            let bold = if liq.value > 10_000.0 { "bold" } else { "normal" };
                            let type_label = match liq.side {
                                LiqSide::Long => "[LONG]",
                                LiqSide::Short => "[SHRT]",
                            };
                            view! {
                                <div class=class>
                                    <div class="tape-row__time tnum">{format_hms_local(liq.time)}</div>
                                    <div class="tape-row__price tnum">{format_price(liq.price)}</div>
                                    <div class="tnum" style=format!("font-weight: {bold}")>
                                        {format_liq_value(liq.value)}
                                    </div>
                                    <div class="tape-row__type">{type_label}</div>
                                </div>
                            }
                        }).collect_view().into_any()
                    }
                }}
            </div>
        </div>
    }
}
