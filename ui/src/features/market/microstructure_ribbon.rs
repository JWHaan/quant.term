//! Port of `src/features/market/MicrostructureRibbon.tsx` — dense derivatives
//! strip: funding · basis · open interest · long/short · liquidations.

use leptos::prelude::*;
use std::cell::RefCell;
use std::rc::Rc;

use super::{
    format_bps, format_volume, futures_contract, liquidation_ws_handlers,
    use_derivatives_snapshot, Liquidation, WsFeed,
};
use crate::stores::{use_stores, BINANCE_FUTURES_WS_URL};

const LIQ_BUFFER_SIZE: usize = 8;
const LIQ_VISIBLE: usize = 3;

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
pub fn MicrostructureRibbon(symbol: Memo<String>) -> impl IntoView {
    let stores = use_stores();
    let contract = Memo::new(move |_| futures_contract(&symbol.get()));
    let spot_symbol = Memo::new(move |_| contract.with(|c| c.spot_symbol.clone()));
    let derivatives = use_derivatives_snapshot(spot_symbol);

    let liquidations = RwSignal::new(Vec::<Liquidation>::new());
    let slot = Rc::new(RefCell::new(None::<LiqSubscription>));

    Effect::new(move |_| {
        let liqs = liquidations;
        let on_liq: Rc<dyn Fn(Liquidation)> = Rc::new(move |event| {
            liqs.update(|list| {
                list.insert(0, event);
                list.truncate(LIQ_BUFFER_SIZE);
            });
        });
        let url = format!("{BINANCE_FUTURES_WS_URL}/!forceOrder@arr");
        let handlers = liquidation_ws_handlers(stores, on_liq);
        let feed = WsFeed::start(&url, handlers);
        *slot.borrow_mut() = Some(LiqSubscription { feed, stores });
    });

    let snap_sig = derivatives.snapshot;
    let err_sig = derivatives.error;
    let snapshot = Memo::new(move |_| snap_sig.get());
    let error = Memo::new(move |_| err_sig.get());

    let funding_bps = move || snapshot.get().map(|s| s.funding_rate * 10_000.0);
    let basis_bps = move || {
        snapshot.get().and_then(|s| {
            if s.index_price != 0.0 {
                Some(((s.mark_price / s.index_price) - 1.0) * 10_000.0)
            } else {
                None
            }
        })
    };
    let base_label = move || spot_symbol.get().replacen("USDT", "", 1);
    let visible_liqs = move || {
        liquidations.with(|l| l.iter().take(LIQ_VISIBLE).cloned().collect::<Vec<_>>())
    };

    view! {
        <section
            class="ribbon"
            aria-label=move || format!("{} microstructure", spot_symbol.get())
            data-testid="microstructure-ribbon"
        >
            {move || match funding_bps() {
                None => view! { <MutedCell label="funding"/> }.into_any(),
                Some(bps) => {
                    let cls = if bps >= 0.0 { "ribbon__value positive" } else { "ribbon__value negative" };
                    view! {
                        <div class="ribbon__cell" data-cell="funding">
                            <span class="ribbon__label">"FUNDING 8H"</span>
                            <span class=cls>{format_bps(bps)}</span>
                        </div>
                    }.into_any()
                }
            }}

            {move || match (basis_bps(), snapshot.get()) {
                (Some(b), Some(_)) => {
                    let cls = if b >= 0.0 { "ribbon__value positive" } else { "ribbon__value negative" };
                    view! {
                        <div class="ribbon__cell" data-cell="basis">
                            <span class="ribbon__label">"BASIS"</span>
                            <span class=cls>{format_bps(b)}</span>
                        </div>
                    }.into_any()
                }
                _ => view! { <MutedCell label="basis"/> }.into_any(),
            }}

            {move || match snapshot.get() {
                None => view! { <MutedCell label="oi"/> }.into_any(),
                Some(s) => view! {
                    <div class="ribbon__cell" data-cell="oi">
                        <span class="ribbon__label">"OPEN INTEREST"</span>
                        <span class="ribbon__value">
                            {format!("${} {}", format_volume(s.open_interest, 2), base_label())}
                        </span>
                    </div>
                }.into_any(),
            }}

            {move || match snapshot.get() {
                None => view! { <MutedCell label="ls"/> }.into_any(),
                Some(s) => {
                    let long_pct = s.long_account * 100.0;
                    let short_pct = s.short_account * 100.0;
                    view! {
                        <div class="ribbon__cell ribbon__cell--wide" data-cell="ls">
                            <span class="ribbon__label">"LONG/SHORT"</span>
                            <div
                                class="ratio-bar ratio-bar--mini"
                                aria-label=format!(
                                    "Long accounts {long_pct:.1} percent, short accounts {short_pct:.1} percent"
                                )
                            >
                                <div style:width=format!("{}%", s.long_account * 100.0)/>
                            </div>
                            <span class="ribbon__sub">
                                <span class="positive">{format!("{:.0}%", long_pct)}</span>
                                " / "
                                <span class="negative">{format!("{:.0}%", short_pct)}</span>
                            </span>
                        </div>
                    }.into_any()
                }
            }}

            <div class="ribbon__cell ribbon__cell--wide" data-cell="liq">
                <span class="ribbon__label">"LIQUIDATIONS"</span>
                {move || {
                    let rows = visible_liqs();
                    if rows.is_empty() {
                        view! { <span class="ribbon__value ribbon__value--muted">"—"</span> }.into_any()
                    } else {
                        view! {
                            <ul class="ribbon__liqs">
                                {rows.into_iter().map(|event| {
                                    let cls = if event.is_buy { "positive" } else { "negative" };
                                    let arrow = if event.is_buy { "▲" } else { "▼" };
                                    let sym_base = event.symbol.replacen("USDT", "", 1);
                                    view! {
                                        <li class=cls>{arrow} " " {sym_base} " $" {format_volume(event.value, 2)}</li>
                                    }
                                }).collect_view()}
                            </ul>
                        }.into_any()
                    }
                }}
            </div>

            {move || error.get().map(|e| view! {
                <span class="ribbon__status" role="status">{e}</span>
            })}
        </section>
    }
}

#[component]
fn MutedCell(label: &'static str) -> impl IntoView {
    view! {
        <div class="ribbon__cell" data-cell=label>
            <span class="ribbon__label">{label.to_uppercase()}</span>
            <span class="ribbon__value ribbon__value--muted">"—"</span>
        </div>
    }
}
