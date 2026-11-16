//! PaperTradingPanel — port of `src/features/trading/PaperTradingPanel.tsx`.
//! Simulated execution only — no orders are ever sent.

use leptos::prelude::*;

use crate::stores::{use_stores, PaperSide, AppStores};

fn format_price(price: f64) -> String {
    if !price.is_finite() || price == 0.0 {
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

/// `formatCurrency` from src/utils/format.ts.
fn format_currency(num: f64, decimals: usize) -> String {
    if !num.is_finite() {
        return "—".to_string();
    }
    let absolute = num.abs();
    let formatted = if absolute >= 1e9 {
        format!("{:.dec$}B", absolute / 1e9, dec = decimals)
    } else if absolute >= 1e6 {
        format!("{:.dec$}M", absolute / 1e6, dec = decimals)
    } else if absolute >= 1e3 {
        format!("{:.dec$}K", absolute / 1e3, dec = decimals)
    } else {
        format!("{absolute:.dec$}", dec = decimals)
    };
    format!("{}{formatted}", if num < 0.0 { "-$" } else { "$" })
}

fn pnl_class(v: f64) -> &'static str {
    if v >= 0.0 {
        "positive"
    } else {
        "negative"
    }
}

fn base_symbol(symbol: &str) -> &str {
    symbol.strip_suffix("USDT").unwrap_or(symbol)
}

/// Paper trading portfolio panel for the selected symbol.
#[component]
pub fn PaperTradingPanel(
    symbol: impl Fn() -> String + Copy + Send + Sync + 'static,
) -> impl IntoView {
    let stores = use_stores();
    let quantity = RwSignal::new("0.01".to_string());
    let leverage = RwSignal::new(1i64);
    let error = RwSignal::new(None::<String>);

    // Keep position marks in sync with live market data.
    Effect::new(move |_| {
        let market_data = stores.market_data.get();
        let positions = stores.positions.get();
        for position in &positions {
            if let Some(live) = market_data.get(&position.symbol) {
                if live.price != position.current_price {
                    stores.update_price(&position.symbol, live.price);
                }
            }
        }
    });

    let market = Memo::new(move |_| stores.get_market_data(&symbol()));

    let unrealized_pnl = Memo::new(move |_| {
        stores
            .positions
            .get()
            .iter()
            .map(|p| AppStores::calculate_position_pnl(p, None))
            .sum::<f64>()
    });
    let equity = Memo::new(move |_| {
        stores.starting_balance.get()
            + stores.realized_pnl.get()
            + unrealized_pnl.get()
    });
    let used_margin = Memo::new(move |_| {
        stores
            .positions
            .get()
            .iter()
            .map(|p| {
                AppStores::calculate_position_margin(p.entry_price, p.quantity, p.leverage)
            })
            .sum::<f64>()
    });
    let free_margin = Memo::new(move |_| equity.get() - used_margin.get());

    let submit = move |side: PaperSide| {
        error.set(None);
        // Number(quantity): unparseable input becomes NaN, which the store
        // rejects with the same "Quantity must be greater than zero" error.
        let qty = quantity.get().trim().parse::<f64>().unwrap_or(f64::NAN);
        let entry_price = market.get().map(|m| m.price).unwrap_or(0.0);
        match stores.open_position(&symbol(), side, qty, leverage.get(), entry_price) {
            Ok(_) => {}
            Err(e) => error.set(Some(e)),
        }
    };

    let submit_long = move |_| submit(PaperSide::Long);
    let submit_short = move |_| submit(PaperSide::Short);

    view! {
        <section class="terminal-stack" aria-label="Paper trading portfolio">
            <div class="paper-disclaimer" role="note">
                <span>"⚠ "</span>" SIMULATED EXECUTION · NO ORDERS ARE SENT"
            </div>

            <div class="metric-grid metric-grid--four">
                <div class="metric"><span>"Equity"</span><strong>{move || format_currency(equity.get(), 2)}</strong></div>
                <div class="metric"><span>"Realized"</span><strong class=move || pnl_class(stores.realized_pnl.get())>{move || format_currency(stores.realized_pnl.get(), 2)}</strong></div>
                <div class="metric"><span>"Unrealized"</span><strong class=move || pnl_class(unrealized_pnl.get())>{move || format_currency(unrealized_pnl.get(), 2)}</strong></div>
                <div class="metric"><span>"Free margin"</span><strong class=move || pnl_class(free_margin.get())>{move || format_currency(free_margin.get(), 2)}</strong></div>
            </div>

            <div class="ticket-row">
                <div class="ticket-price">
                    <span>{move || format!("{}/USDT", base_symbol(&symbol()))}</span>
                    <strong>{move || market.get().map(|m| format_price(m.price)).unwrap_or_else(|| "WAITING…".to_string())}</strong>
                </div>
                <label>
                    <span>"Quantity"</span>
                    <input
                        prop:value=move || quantity.get()
                        on:input=move |ev| quantity.set(event_target_value(&ev))
                        aria-label="Paper trade quantity"
                    />
                </label>
                <label>
                    <span>"Leverage"</span>
                    <select
                        prop:value=move || leverage.get().to_string()
                        on:change=move |ev| {
                            leverage.set(event_target_value(&ev).parse::<i64>().unwrap_or(1));
                        }
                        aria-label="Paper trade leverage"
                    >
                        {[1i64, 2, 5, 10].into_iter().map(|v| {
                            view! {
                                <option value=v.to_string()>{format!("{v}×")}</option>
                            }
                        }).collect_view()}
                    </select>
                </label>
                <button
                    class="trade-button trade-button--long"
                    prop:disabled=move || market.get().map(|m| m.price).unwrap_or(0.0) <= 0.0
                    on:click=submit_long
                >
                    <span>"↗ "</span>" Long"
                </button>
                <button
                    class="trade-button trade-button--short"
                    prop:disabled=move || market.get().map(|m| m.price).unwrap_or(0.0) <= 0.0
                    on:click=submit_short
                >
                    <span>"↘ "</span>" Short"
                </button>
            </div>
            {move || error.get().map(|e| view! {
                <div class="inline-error" role="alert">{e}</div>
            })}

            <div class="terminal-table-wrap">
                <table class="terminal-table">
                    <thead>
                        <tr>
                            <th>"Position"</th><th>"Qty"</th><th>"Entry"</th>
                            <th>"Mark"</th><th>"Margin"</th><th>"P&L"</th>
                            <th><span class="sr-only">"Actions"</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        <For
                            each=move || stores.positions.get()
                            key=|p| p.id.clone()
                            children=move |position| {
                                let pnl = AppStores::calculate_position_pnl(&position, None);
                                let margin = AppStores::calculate_position_margin(
                                    position.entry_price,
                                    position.quantity,
                                    position.leverage,
                                );
                                let side_class = if position.side == PaperSide::Long {
                                    "positive"
                                } else {
                                    "negative"
                                };
                                let side_label = if position.side == PaperSide::Long {
                                    "LONG"
                                } else {
                                    "SHORT"
                                };
                                let base = base_symbol(&position.symbol).to_string();
                                let symbol_display = position.symbol.clone();
                                let position_id = position.id.clone();
                                view! {
                                    <tr>
                                        <td>
                                            <span class=side_class>{side_label}</span>
                                            " " {base} " "
                                            <small>{format!("{}×", position.leverage)}</small>
                                        </td>
                                        <td>{position.quantity}</td>
                                        <td>{format_price(position.entry_price)}</td>
                                        <td>{format_price(position.current_price)}</td>
                                        <td>{format_currency(margin, 2)}</td>
                                        <td class=pnl_class(pnl)>{format_currency(pnl, 2)}</td>
                                        <td>
                                            <button
                                                class="icon-action"
                                                on:click=move |_| {
                                                    stores.close_position(
                                                        &position_id,
                                                        position.current_price,
                                                    );
                                                }
                                                aria-label=format!(
                                                    "Close {} {} position at its latest recorded mark",
                                                    side_label, symbol_display
                                                )
                                            >"✕"</button>
                                        </td>
                                    </tr>
                                }
                            }
                        />
                        {move || {
                            stores.positions.with(|ps| ps.is_empty()).then(|| {
                                view! {
                                    <tr><td colspan="7" class="empty-cell">
                                        "No open paper positions"
                                    </td></tr>
                                }
                            })
                        }}
                    </tbody>
                </table>
            </div>
        </section>
    }
}
