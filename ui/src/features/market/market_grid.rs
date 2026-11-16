//! Port of `src/features/market/MarketGrid.tsx` — collapsible TICK board
//! seeded from the Binance 24hr mini-ticker REST endpoint, then streamed via
//! combined `@miniTicker` WebSocket streams, plus a PERPS funding table.

use leptos::prelude::*;
use serde_json::Value;
use std::cell::{Cell, RefCell};
use std::collections::HashMap;
use std::rc::Rc;

use super::{
    build_watchlist_seed_url, build_watchlist_stream_url, extract_ticker_values, format_bps,
    format_countdown, format_percent, format_price, format_volume, js_to_number, parse_ticker,
    restart_flash_animation, use_tick_flash, IntervalGuard, PollGuard, TimeoutGuard, WatchlistRow,
    WsFeed, WsHandlers, IconSearch, IconX,
};
use crate::services::telemetry::{
    next_owner_id, record_live_market_event, release_live_connection, report_live_connection,
};
use crate::stores::{
    use_stores, now_ms, ConnectionStatus, MarketDataUpdate, AppStores, BINANCE_FUTURES_REST_URL,
};

const MAJOR_BASES: [&str; 6] = ["BTC", "ETH", "BNB", "SOL", "XRP", "DOGE"];
const SECTIONS_STORAGE_KEY: &str = "qt.tickboard.sections";
const PERPS_POLL_INTERVAL_MS: i32 = 60_000;
const PERPS_UNAVAILABLE_MESSAGE: &str = "Perps data unavailable";

#[derive(Clone, Copy)]
struct Sections {
    majors: bool,
    perps: bool,
    movers: bool,
}

impl Sections {
    fn toggle(&mut self, id: TickSectionId) {
        match id {
            TickSectionId::Majors => self.majors = !self.majors,
            TickSectionId::Perps => self.perps = !self.perps,
            TickSectionId::Movers => self.movers = !self.movers,
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum TickSectionId {
    Majors,
    Perps,
    Movers,
}

fn read_initial_sections() -> Sections {
    let Some(raw) = super::ls_get(SECTIONS_STORAGE_KEY) else {
        return Sections { majors: true, perps: true, movers: true };
    };
    let Ok(v) = serde_json::from_str::<Value>(&raw) else {
        return Sections { majors: true, perps: true, movers: true };
    };
    let flag = |key: &str, default: bool| {
        v.get(key).and_then(Value::as_bool).unwrap_or(default)
    };
    Sections {
        majors: flag("majors", true),
        perps: flag("perps", true),
        movers: flag("movers", true),
    }
}

// ─── Ticker partitioning (pure helper, mirrors partitionTickSections) ────────

#[derive(Clone, Default, PartialEq)]
struct TickSections {
    majors: Vec<WatchlistRow>,
    movers_up: Vec<WatchlistRow>,
    movers_down: Vec<WatchlistRow>,
}

fn base_symbol(symbol: &str) -> &str {
    symbol
        .strip_suffix("USDT")
        .or_else(|| symbol.strip_suffix("USD"))
        .unwrap_or(symbol)
}

fn partition_tick_sections(data: &[WatchlistRow]) -> TickSections {
    let mut by_base: HashMap<String, WatchlistRow> = HashMap::new();
    for item in data {
        let base = base_symbol(&item.symbol).to_string();
        by_base.entry(base).or_insert_with(|| item.clone());
    }

    let mut majors = Vec::new();
    for base in MAJOR_BASES {
        if let Some(item) = by_base.get(base) {
            majors.push(item.clone());
        }
    }

    let major_symbols: std::collections::HashSet<String> =
        majors.iter().map(|m| m.symbol.clone()).collect();
    let mut movers: Vec<WatchlistRow> = data
        .iter()
        .filter(|item| !major_symbols.contains(&item.symbol))
        .cloned()
        .collect();
    movers.sort_by(|a, b| {
        b.price_change_percent
            .partial_cmp(&a.price_change_percent)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    TickSections {
        majors,
        movers_up: movers.iter().take(5).cloned().collect(),
        movers_down: movers.iter().rev().take(5).cloned().collect(),
    }
}

// ─── PERPS funding rows ──────────────────────────────────────────────────────

#[derive(Clone)]
struct PerpsRow {
    symbol: String,
    base: String,
    mark_price: f64,
    funding_bps: f64,
    next_funding_time: f64,
}

#[derive(Clone, Default)]
struct PerpsState {
    rows: Option<Vec<PerpsRow>>,
    error: Option<String>,
}

/// `toPerpsRows` — keeps only the six major USDT perpetuals.
fn to_perps_rows(payload: &Value) -> Vec<PerpsRow> {
    let wanted: std::collections::HashSet<String> =
        MAJOR_BASES.iter().map(|b| format!("{b}USDT")).collect();
    let Some(arr) = payload.as_array() else {
        return Vec::new();
    };
    arr.iter()
        .filter_map(|record| {
            let symbol = record.get("symbol").and_then(Value::as_str)?;
            if !wanted.contains(symbol) {
                return None;
            }
            // TS: Number(x) || 0 — NaN and 0 both collapse to 0.
            let num_or_zero = |key: &str| -> f64 {
                let n = record.get(key).map(js_to_number).unwrap_or(f64::NAN);
                if n.is_finite() && n != 0.0 {
                    n
                } else {
                    0.0
                }
            };
            Some(PerpsRow {
                symbol: symbol.to_string(),
                base: base_symbol(symbol).to_string(),
                mark_price: num_or_zero("markPrice"),
                funding_bps: num_or_zero("lastFundingRate") * 10_000.0,
                next_funding_time: num_or_zero("nextFundingTime"),
            })
        })
        .collect()
}

// ─── Rows / table components ─────────────────────────────────────────────────

type RowsMap = RwSignal<HashMap<String, WatchlistRow>>;

#[component]
fn QuoteTable(
    rows: Memo<Vec<WatchlistRow>>,
    rows_map: RowsMap,
    on_select: impl Fn(String) + Copy + Send + Sync + 'static,
    aria_label: &'static str,
) -> impl IntoView {
    let row_symbols = move || {
        rows.get()
            .into_iter()
            .map(|r| r.symbol)
            .collect::<Vec<String>>()
    };
    view! {
        <table class="market-grid__table" aria-label=aria_label>
            <colgroup>
                <col class="market-grid__col-symbol"/>
                <col class="market-grid__col-price"/>
                <col class="market-grid__col-change"/>
                <col class="market-grid__col-volume"/>
            </colgroup>
            <thead>
                <tr>
                    <th scope="col">"Symbol"</th>
                    <th scope="col">"Last"</th>
                    <th scope="col">"24H"</th>
                    <th scope="col">"Vol"</th>
                </tr>
            </thead>
            <tbody>
                <For
                    each=row_symbols
                    key=|s| s.clone()
                    children=move |symbol| view! {
                        <MarketRow symbol=symbol rows_map=rows_map on_select=on_select/>
                    }
                />
            </tbody>
        </table>
    }
}

#[component]
fn MarketRow(
    symbol: String,
    rows_map: RowsMap,
    on_select: impl Fn(String) + Copy + Send + Sync + 'static,
) -> impl IntoView {
    let stores = use_stores();
    let sym_for_row = symbol.clone();
    let row = Memo::new(move |_| rows_map.with(|m| m.get(&sym_for_row).cloned()));
    let price_memo = Memo::new(move |_| row.with(|r| r.as_ref().map(|x| x.price)));
    let flash = use_tick_flash(price_memo, symbol.clone());
    let flash_dir = flash.direction;
    let flash_nonce = flash.nonce;

    // Restart the tick-flash CSS animation on each new tick (React used `key`).
    {
        let sym = symbol.clone();
        Effect::new(move |_| {
            let n = flash_nonce.get();
            if n > 0 {
                restart_flash_animation(&sym);
            }
        });
    }

    let is_selected = Memo::new({
        let symbol = symbol.clone();
        move |_| stores.selected_symbol.get() == symbol
    });
    let base = base_symbol(&symbol).to_string();
    let sym_for_select = symbol.clone();
    let sym_for_key = symbol.clone();

    let select_row = move |_| on_select(sym_for_select.clone());

    view! {
        <tr
            class="market-grid__row"
            data-selected=move || is_selected.get().to_string()
            aria-selected=move || is_selected.get().to_string()
            tabindex="0"
            data-row-symbol=symbol.clone()
            on:click=select_row
            on:keydown=move |ev| {
                let key = ev.key();
                if key == "Enter" || key == " " {
                    ev.prevent_default();
                    on_select(sym_for_key.clone());
                }
            }
            aria-label=move || {
                row.with(|r| {
                    r.as_ref()
                        .map(|item| format!(
                            "{}, {}, price {}, 24 hour change {}, volume {}",
                            item.name,
                            base_symbol(&item.symbol),
                            format_price(item.price),
                            format_percent(item.price_change_percent, 2),
                            format_volume(item.quote_volume, 2),
                        ))
                        .unwrap_or_default()
                })
            }
            title=move || {
                row.with(|r| {
                    r.as_ref()
                        .map(|item| format!("{} · {}", item.name, item.category))
                        .unwrap_or_default()
                })
            }
        >
            <td class="market-grid__symbol">{base}</td>
            <td class=move || match flash_dir.get() {
                Some(super::TickDirection::Up) => "market-grid__price tick-flash--up",
                Some(super::TickDirection::Down) => "market-grid__price tick-flash--down",
                None => "market-grid__price",
            }>
                {move || row.with(|r| r.as_ref().map(|x| format_price(x.price)).unwrap_or_default())}
            </td>
            <td class=move || {
                let pos = row.with(|r| r.as_ref().map(|x| x.price_change_percent >= 0.0).unwrap_or(true));
                if pos { "market-grid__change market-grid__change--positive" } else { "market-grid__change market-grid__change--negative" }
            }>
                {move || row.with(|r| r.as_ref().map(|x| format_percent(x.price_change_percent, 2)).unwrap_or_default())}
            </td>
            <td class="market-grid__volume">
                {move || row.with(|r| r.as_ref().map(|x| format!("${}", format_volume(x.quote_volume, 1))).unwrap_or_default())}
            </td>
        </tr>
    }
}

#[component]
fn TickSection(
    id: TickSectionId,
    title: &'static str,
    expanded: Memo<bool>,
    on_toggle: impl Fn(TickSectionId) + Copy + Send + Sync + 'static,
    body: impl Fn() -> AnyView + Copy + Send + Sync + 'static,
) -> impl IntoView {
    let slug = match id {
        TickSectionId::Majors => "majors",
        TickSectionId::Perps => "perps",
        TickSectionId::Movers => "movers",
    };
    let dom_id = format!("tickboard-body-{slug}");
    let test_id = format!("tick-section-{slug}");
    view! {
        <section class="tickboard__section" data-testid=test_id>
            <button
                type="button"
                class="tickboard__section-header"
                aria-expanded=move || expanded.get().to_string()
                aria-controls=dom_id.clone()
                on:click=move |_| on_toggle(id)
            >
                <span
                    class=move || if expanded.get() { "tickboard__chevron" } else { "tickboard__chevron tickboard__chevron--collapsed" }
                    aria-hidden="true"
                >"▾"</span>
                <span class="tickboard__title">{title}</span>
            </button>
            {move || expanded.get().then(|| {
                view! { <div id=dom_id.clone() class="tickboard__section-body">{body()}</div> }
            })}
        </section>
    }
}

// ─── Main component ──────────────────────────────────────────────────────────

/// Owns the watchlist feed: seed fetch + miniTicker WS + reconnect reporting.
struct GridFeed {
    feed: WsFeed,
    owner_id: usize,
    stores: AppStores,
    _seed_timeout: TimeoutGuard,
    _seed_alive: Rc<Cell<bool>>,
}

impl Drop for GridFeed {
    fn drop(&mut self) {
        self._seed_alive.set(false);
        release_live_connection(&self.stores, self.owner_id);
    }
}

#[component]
pub fn MarketGrid(
    on_select_symbol: Option<impl Fn(String) + Copy + Send + Sync + 'static>,
) -> impl IntoView {
    let stores = use_stores();

    let rows_map = RwSignal::new(HashMap::<String, WatchlistRow>::new());
    let search_query = RwSignal::new(String::new());
    let loading = RwSignal::new(true);
    let error = RwSignal::new(None::<String>);
    let sections = RwSignal::new(read_initial_sections());
    let perps_state = RwSignal::new(PerpsState::default());
    let now = RwSignal::new(now_ms());

    let visible = Memo::new(move |_| {
        let q = search_query.get().to_lowercase();
        rows_map.with(|map| {
            map.values()
                .filter(|item| {
                    q.is_empty()
                        || item.name.to_lowercase().contains(&q)
                        || item.symbol.to_lowercase().contains(&q)
                })
                .cloned()
                .collect::<Vec<_>>()
        })
    });

    let tick_sections = Memo::new(move |_| partition_tick_sections(&visible.get()));
    let majors_rows = Memo::new(move |_| tick_sections.with(|s| s.majors.clone()));
    let movers_up_rows = Memo::new(move |_| tick_sections.with(|s| s.movers_up.clone()));
    let movers_down_rows = Memo::new(move |_| tick_sections.with(|s| s.movers_down.clone()));

    let select_symbol = move |sym: String| match on_select_symbol {
        Some(f) => f(sym),
        None => stores.set_symbol(&sym),
    };

    // ── Watchlist feed effect (mount once) ──────────────────────────────────
    let feed_slot = Rc::new(RefCell::new(None::<GridFeed>));
    Effect::new(move |_| {
        let owner_id = next_owner_id();
        report_live_connection(&stores, "marketData", owner_id, Some(ConnectionStatus::Connecting));

        // Shared ticker application (seed + WS).
        let apply: Rc<dyn Fn(Vec<Value>) -> bool> = {
            let rows_map = rows_map;
            let loading = loading;
            Rc::new(move |values: Vec<Value>| {
                let mut displays = Vec::new();
                let mut updates: Vec<(String, MarketDataUpdate)> = Vec::new();
                for v in &values {
                    if let Some((display, store)) = parse_ticker(v) {
                        updates.push((display.symbol.clone(), store));
                        displays.push(display);
                    }
                }
                if displays.is_empty() {
                    return false;
                }
                rows_map.update(|map| {
                    for d in &displays {
                        map.insert(d.symbol.clone(), d.clone());
                    }
                });
                for (sym, upd) in updates {
                    stores.update_market_data(&sym, upd);
                }
                loading.set(false);
                true
            })
        };

        // Seed fetch with 8s timeout (mirrors the AbortController + setTimeout).
        let seed_alive = Rc::new(Cell::new(true));
        let seed_done = Rc::new(Cell::new(false));
        let seed_timed_out = Rc::new(Cell::new(false));
        let seed_timeout = {
            let done = seed_done.clone();
            let timed_out = seed_timed_out.clone();
            let loading = loading;
            let error = error;
            let cb = wasm_bindgen::closure::Closure::wrap(Box::new(move |_: web_sys::Event| {
                if done.get() {
                    return;
                }
                timed_out.set(true);
                loading.set(false);
                error.set(Some("Watchlist seed timed out; waiting for live feed".to_string()));
            }) as Box<dyn FnMut(web_sys::Event)>);
            TimeoutGuard::new(cb, 8_000)
        };

        // REST seed.
        {
            let apply = apply.clone();
            let seed_done = seed_done.clone();
            let seed_timed_out = seed_timed_out.clone();
            let loading = loading;
            let error = error;
            let alive = seed_alive.clone();
            leptos::task::spawn_local(async move {
                let url = build_watchlist_seed_url();
                let result = super::fetch_json(&url).await;
                seed_done.set(true);
                if !alive.get() || seed_timed_out.get() {
                    return;
                }
                match result {
                    Ok(v) => match v.as_array() {
                        Some(arr) => {
                            let values: Vec<Value> = arr.clone();
                            if !apply(values) {
                                loading.set(false);
                                error.set(Some("No current watchlist markets returned".to_string()));
                            }
                        }
                        None => {
                            loading.set(false);
                            error.set(Some("Unexpected watchlist response".to_string()));
                        }
                    },
                    Err(e) => {
                        loading.set(false);
                        error.set(Some(e));
                    }
                }
            });
        }

        // miniTicker combined stream.
        let on_message: Rc<dyn Fn(&str)> = {
            let apply = apply.clone();
            Rc::new(move |text| {
                let Ok(payload) = serde_json::from_str::<Value>(text) else {
                    {
                        #[cfg(target_arch = "wasm32")]
                        web_sys::console::error_1(
                            &"[Binance watchlist] Failed to parse ticker stream".into(),
                        );
                    }
                    return;
                };
                let values = extract_ticker_values(&payload);
                // Telemetry timestamp from the first event's `E` field.
                let ts = values
                    .iter()
                    .find_map(|v| v.get("E").map(js_to_number))
                    .filter(|t| t.is_finite());
                let symbols: Vec<String> = values
                    .iter()
                    .filter_map(|v| {
                        v.get("s")
                            .or_else(|| v.get("symbol"))
                            .and_then(Value::as_str)
                            .map(str::to_string)
                    })
                    .collect();
                if !apply(values) {
                    return;
                }
                for sym in symbols {
                    record_live_market_event("binance", ts, &sym);
                }
                report_live_connection(&stores, "marketData", owner_id, Some(ConnectionStatus::Connected));
                error.set(None);
            })
        };

        let mut handlers = WsHandlers::new(move |text| on_message(text));
        handlers.on_reconnect = Some(Rc::new({
            let st = stores;
            move || {
                report_live_connection(&st, "marketData", owner_id, Some(ConnectionStatus::Reconnecting));
                error.set(Some("Live watchlist feed reconnecting".to_string()));
            }
        }));
        handlers.on_error = Some(Rc::new({
            let st = stores;
            move || {
                report_live_connection(&st, "marketData", owner_id, Some(ConnectionStatus::Error));
            }
        }));
        handlers.stale_after_ms = 10_000.0;

        let url = build_watchlist_stream_url();
        let feed = WsFeed::start(&url, handlers);

        *feed_slot.borrow_mut() = Some(GridFeed {
            feed,
            owner_id,
            stores,
            _seed_timeout: seed_timeout,
            _seed_alive: seed_alive,
        });
    });

    // ── PERPS funding poll (only while the section is expanded) ─────────────
    let perps_open = Memo::new(move |_| sections.with(|s| s.perps));
    let perps_slot = Rc::new(RefCell::new(None::<PollGuard>));
    Effect::new(move |_| {
        if !perps_open.get() {
            *perps_slot.borrow_mut() = None;
            return;
        }
        let alive = Rc::new(Cell::new(true));
        let state = perps_state;
        let spawn_poll = {
            let alive = alive.clone();
            move || {
                let alive = alive.clone();
                leptos::task::spawn_local(async move {
                    let url = format!("{BINANCE_FUTURES_REST_URL}/fapi/v1/premiumIndex");
                    let result = super::fetch_json(&url).await;
                    if !alive.get() {
                        return;
                    }
                    match result {
                        Ok(v) => match v.as_array() {
                            Some(arr) => {
                                let payload = Value::Array(arr.clone());
                                state.set(PerpsState {
                                    rows: Some(to_perps_rows(&payload)),
                                    error: None,
                                });
                            }
                            None => {
                                state.set(PerpsState {
                                    rows: None,
                                    error: Some(PERPS_UNAVAILABLE_MESSAGE.to_string()),
                                });
                            }
                        },
                        Err(_) => {
                            state.set(PerpsState {
                                rows: None,
                                error: Some(PERPS_UNAVAILABLE_MESSAGE.to_string()),
                            });
                        }
                    }
                });
            }
        };
        spawn_poll();
        let cb = wasm_bindgen::closure::Closure::wrap(Box::new(move |_: web_sys::Event| spawn_poll()) as Box<dyn FnMut(web_sys::Event)>);
        *perps_slot.borrow_mut() = Some(PollGuard {
            alive,
            _interval: Some(IntervalGuard::new(cb, PERPS_POLL_INTERVAL_MS)),
            _timeout: None,
        });
    });

    // ── Countdown ticker (1s while PERPS expanded) ──────────────────────────
    let countdown_slot = Rc::new(RefCell::new(None::<PollGuard>));
    Effect::new(move |_| {
        if !perps_open.get() {
            *countdown_slot.borrow_mut() = None;
            return;
        }
        let alive = Rc::new(Cell::new(true));
        let cb = wasm_bindgen::closure::Closure::wrap(Box::new(move |_: web_sys::Event| {
            now.set(now_ms());
        }) as Box<dyn FnMut(web_sys::Event)>);
        *countdown_slot.borrow_mut() = Some(PollGuard {
            alive,
            _interval: Some(IntervalGuard::new(cb, 1_000)),
            _timeout: None,
        });
    });

    // ── Persist section toggles ─────────────────────────────────────────────
    Effect::new(move |_| {
        let s = sections.get();
        let payload = serde_json::json!({
            "majors": s.majors,
            "perps": s.perps,
            "movers": s.movers,
        });
        super::ls_set(SECTIONS_STORAGE_KEY, &payload.to_string());
    });

    let handle_toggle = move |id: TickSectionId| {
        sections.update(|s| s.toggle(id));
    };

    // PERPS section body (loading / unavailable / funding table). Signal reads
    // happen inside a tracked child closure so polls + the 1s countdown rerender.
    let perps_body = move || -> AnyView {
        view! {
            {move || {
                let state = perps_state.get();
                let rows_empty = state.rows.as_ref().map(|r| r.is_empty()).unwrap_or(true);
                if state.error.is_some() && rows_empty {
                    return view! {
                        <p class="tickboard__muted" role="status" aria-live="polite">
                            {PERPS_UNAVAILABLE_MESSAGE}
                        </p>
                    }
                    .into_any();
                }
                if rows_empty {
                    return view! {
                        <p class="tickboard__muted" role="status" aria-live="polite">
                            "Loading funding rates"
                        </p>
                    }
                    .into_any();
                }
                let rows = state.rows.unwrap_or_default();
                let now_ms_val = now.get();
                view! {
                    <table class="market-grid__table" aria-label="Major perpetual funding">
                        <colgroup>
                            <col class="market-grid__col-symbol"/>
                            <col class="market-grid__col-price"/>
                            <col class="market-grid__col-change"/>
                            <col class="market-grid__col-volume"/>
                        </colgroup>
                        <thead>
                            <tr>
                                <th scope="col">"Symbol"</th>
                                <th scope="col">"Mark"</th>
                                <th scope="col">"Funding"</th>
                                <th scope="col">"Next"</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.into_iter().map(|row| {
                                let cls = if row.funding_bps >= 0.0 {
                                    "market-grid__change positive"
                                } else {
                                    "market-grid__change negative"
                                };
                                view! {
                                    <tr
                                        class="market-grid__row"
                                        aria-label=format!(
                                            "{} perpetual funding {}",
                                            row.base,
                                            format_bps(row.funding_bps)
                                        )
                                    >
                                        <td class="market-grid__symbol">{row.base.clone()}</td>
                                        <td class="market-grid__price">{format_price(row.mark_price)}</td>
                                        <td class=cls>{format_bps(row.funding_bps)}</td>
                                        <td class="market-grid__volume">
                                            {format_countdown(row.next_funding_time - now_ms_val)}
                                        </td>
                                    </tr>
                                }
                            }).collect_view()}
                        </tbody>
                    </table>
                }
                .into_any()
            }}
        }
        .into_any()
    };

    let visible_count = move || visible.with(|v| v.len());
    let is_loading = move || loading.get();
    let has_visible = move || !visible.with(|v| v.is_empty());

    view! {
        <div class="tickboard">
            <div class="market-grid__toolbar">
                <div class="market-grid__search">
                    <IconSearch/>
                    <label class="visually-hidden" for="market-watch-search">"Filter market watchlist"</label>
                    <input
                        id="market-watch-search"
                        type="search"
                        placeholder="Filter assets"
                        prop:value=move || search_query.get()
                        on:input=move |ev| search_query.set(event_target_value(&ev))
                        autocomplete="off"
                        {::leptos::attr::custom::custom_attribute("spellcheck", "false")}
                    />
                    {move || (!search_query.get().is_empty()).then(|| view! {
                        <button
                            type="button"
                            class="market-grid__clear"
                            on:click=move |_| search_query.set(String::new())
                            aria-label="Clear asset filter"
                        >
                            <IconX/>
                        </button>
                    })}
                </div>
                <output
                    id="market-watch-count"
                    class="market-grid__count"
                    aria-label=move || format!("{} assets shown", visible_count())
                >
                    {move || visible_count().to_string()}
                </output>
            </div>

            {move || error.get().map(|e| view! {
                <div class="market-grid__feed-status" role="status" aria-live="polite">
                    <span aria-hidden="true"/>
                    {e}
                </div>
            })}

            <div class="tickboard__scroller">
                <TickSection
                    id=TickSectionId::Majors
                    title="MAJORS"
                    expanded=Memo::new(move |_| sections.with(|s| s.majors))
                    on_toggle=handle_toggle
                    body=move || view! {
                        <QuoteTable rows=majors_rows rows_map=rows_map on_select=select_symbol aria_label="Major asset watchlist"/>
                    }.into_any()
                />
                <TickSection
                    id=TickSectionId::Perps
                    title="PERPS"
                    expanded=Memo::new(move |_| sections.with(|s| s.perps))
                    on_toggle=handle_toggle
                    body=perps_body
                />
                <TickSection
                    id=TickSectionId::Movers
                    title="MOVERS"
                    expanded=Memo::new(move |_| sections.with(|s| s.movers))
                    on_toggle=handle_toggle
                    body=move || view! {
                        <div class="tickboard__group">
                            <span class="tickboard__group-label">"TOP ↑"</span>
                            <QuoteTable rows=movers_up_rows rows_map=rows_map on_select=select_symbol aria_label="Top gaining assets"/>
                        </div>
                        <div class="tickboard__group">
                            <span class="tickboard__group-label">"TOP ↓"</span>
                            <QuoteTable rows=movers_down_rows rows_map=rows_map on_select=select_symbol aria_label="Top losing assets"/>
                        </div>
                    }.into_any()
                />

                {move || {
                    if is_loading() && !has_visible() {
                        view! {
                            <div class="market-grid__empty" role="status" aria-live="polite">
                                <span class="market-grid__loader" aria-hidden="true"/>
                                "Loading live markets"
                            </div>
                        }.into_any()
                    } else if !is_loading() && !has_visible() {
                        view! {
                            <div class="market-grid__empty">
                                {format!("No assets match “{}”", search_query.get())}
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
