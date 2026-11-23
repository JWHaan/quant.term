//! Strategy Lab — port of `src/features/backtest/StrategyLab.tsx`.
//! Config → `quant_core::typed::run_backtest` → metrics + equity curve +
//! trades/diagnostics tabs. The Binance-history path mirrors
//! `fetchKlinesRange` + `buildDatasetMeta` + `detectGaps`.

use std::sync::Arc;

use leptos::prelude::*;
use quant_core::typed::{self, BacktestConfig, BacktestFixture, BacktestResult, DatasetSource};
use wasm_bindgen::JsCast;
use wasm_bindgen_futures::spawn_local;

use crate::stores::now_ms;

use super::equity_curve::EquityCurveChart;
use super::format::{
    checksum_tail, describe_gap_report, format_currency, format_price, format_timestamp, fmt_num,
    signed_percent,
};
use super::klines::{self, KlinesError, KlinesRangeRequest};

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum DatasetChoice {
    Fixture,
    Binance,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum RunStatus {
    Idle,
    Success,
    Error,
}

impl RunStatus {
    fn as_str(&self) -> &'static str {
        match self {
            RunStatus::Idle => "idle",
            RunStatus::Success => "success",
            RunStatus::Error => "error",
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum LoadState {
    Idle,
    Loading,
    Ready,
    Error,
}

/// Reusable labelled number input matching the TS `updateConfig` pattern:
/// the getter reads the signal, the setter writes the parsed f64 (NaN allowed —
/// the engine validator surfaces it, exactly like `Number(event.target.value)`).
#[component]
fn ConfigNumberInput(
    label: &'static str,
    aria_label: &'static str,
    min: &'static str,
    max: &'static str,
    step: &'static str,
    get: impl Fn() -> f64 + Copy + Send + Sync + 'static,
    set: impl Fn(f64) + Copy + Send + Sync + 'static,
    wide: bool,
) -> impl IntoView {
    view! {
        <label class=move || if wide { "backtest-field--wide" } else { "" }>
            <span>{label}</span>
            <input
                aria-label=aria_label
                type="number"
                min=min
                max=max
                step=step
                prop:value=move || fmt_num(get())
                on:input=move |ev| {
                    let v = event_target_value(&ev).parse::<f64>().unwrap_or(f64::NAN);
                    set(v);
                }
            />
        </label>
    }
}

#[component]
fn TextInput(
    label: &'static str,
    aria_label: &'static str,
    value: RwSignal<String>,
    wide: bool,
) -> impl IntoView {
    view! {
        <label class=move || if wide { "backtest-field--wide" } else { "" }>
            <span>{label}</span>
            <input
                aria-label=aria_label
                type="text"
                spellcheck="false"
                autocomplete="off"
                prop:value=move || value.get()
                on:input=move |ev| value.set(event_target_value(&ev))
            />
        </label>
    }
}

/// `on_result` mirrors the optional TS callback (`onResult?`). `Option` props
/// are optional in Leptos, so `<StrategyLab />` works with no arguments.
#[component]
pub fn StrategyLab(
    #[prop(optional)]
    on_result: Option<Arc<dyn Fn(BacktestResult) + Send + Sync + 'static>>,
) -> impl IntoView {
    let fixture = Arc::new(typed::synthetic_fixture());
    let config = RwSignal::new(BacktestConfig::default());
    let result = RwSignal::new(None::<BacktestResult>);
    let status = RwSignal::new(RunStatus::Idle);
    let message = RwSignal::new(
        "Configure the replay, then run it against the verified synthetic fixture."
            .to_string(),
    );
    let active_tab = RwSignal::new("trades");

    let dataset_choice = RwSignal::new(DatasetChoice::Fixture);
    let binance_symbol = RwSignal::new("BTCUSDT".to_string());
    let binance_interval = RwSignal::new("1m".to_string());
    let binance_lookback = RwSignal::new(1_000.0f64);
    let live_dataset = RwSignal::new(None::<BacktestFixture>);
    let load_state = RwSignal::new(LoadState::Idle);
    let load_message = RwSignal::new(String::new());

    // Generation counter invalidating stale async fetches — the Leptos
    // equivalent of the TS AbortController + `controller.signal.aborted` checks.
    let fetch_gen = RwSignal::new(0u64);

    // Abort any in-flight history fetch when the form changes (TS effect cleanup).
    let fetch_gen_fx = fetch_gen;
    Effect::new(move |_| {
        let _ = binance_symbol.get();
        let _ = binance_interval.get();
        let _ = binance_lookback.get();
        fetch_gen_fx.set(fetch_gen_fx.get_untracked().wrapping_add(1));
        load_state.set(LoadState::Idle);
    });

    // TS `activeFixture`: the fetched Binance dataset only applies while the
    // "Binance history" source is selected; otherwise the fixture is used.
    let active_fixture = Memo::new(move |_| {
        if dataset_choice.get() == DatasetChoice::Binance {
            live_dataset
                .get()
                .unwrap_or_else(|| fixture.as_ref().clone())
        } else {
            fixture.as_ref().clone()
        }
    });

    let active_gap_report = Memo::new(move |_| {
        let fx = active_fixture.get();
        if fx.dataset.source == DatasetSource::BinanceRest {
            typed::interval_seconds(&fx.dataset.interval)
                .map(|secs| typed::detect_gaps(&fx.candles, secs))
        } else {
            None
        }
    });

    let source_chip = move || {
        if active_fixture.get().dataset.source == DatasetSource::SyntheticFixture {
            "SOURCE: FIXTURE"
        } else {
            "SOURCE: BINANCE REST"
        }
    };

    let on_fetch_binance = move |_| {
        let symbol = binance_symbol.get().trim().to_uppercase();
        if symbol.is_empty() {
            load_state.set(LoadState::Error);
            load_message.set("Enter a Binance symbol before fetching history.".to_string());
            return;
        }

        // Cancel any prior walk so only the latest request can settle into state.
        fetch_gen.set(fetch_gen.get().wrapping_add(1));
        let my_gen = fetch_gen.get();
        let interval = binance_interval.get();
        let lookback = binance_lookback.get();

        load_state.set(LoadState::Loading);
        load_message.set(format!(
            "Fetching {} {} candles for {}…",
            fmt_num(lookback),
            interval,
            symbol
        ));

        let gen = fetch_gen;
        spawn_local(async move {
            let request = KlinesRangeRequest {
                symbol: &symbol,
                interval: &interval,
                lookback_bars: Some(lookback),
                start_time: None,
                end_time: None,
                max_candles: None,
            };
            match klines::fetch_klines_range(&request).await {
                Ok(candles) => {
                    if gen.get() != my_gen {
                        return;
                    }
                    if candles.is_empty() {
                        load_state.set(LoadState::Error);
                        load_message.set(format!(
                            "No closed candles available for {symbol} {interval}"
                        ));
                        return;
                    }
                    let fetched_at = now_ms();
                    match typed::build_dataset_meta(&candles, &symbol, &interval, fetched_at) {
                        Some(dataset) => {
                            let count = candles.len();
                            live_dataset.set(Some(BacktestFixture { candles, dataset }));
                            load_state.set(LoadState::Ready);
                            load_message.set(format!(
                                "Loaded {count} closed candles of {symbol} {interval} history."
                            ));
                        }
                        None => {
                            load_state.set(LoadState::Error);
                            load_message.set("Failed to build dataset metadata".to_string());
                        }
                    }
                }
                Err(e) => {
                    if gen.get() != my_gen {
                        return;
                    }
                    load_state.set(LoadState::Error);
                    load_message.set(match e {
                        KlinesError::Timeout => "request timed out".to_string(),
                        other => other.to_string(),
                    });
                }
            }
        });
    };

    let on_run_backtest = move |_| {
        let fx = active_fixture.get();
        let cfg = config.get();
        match typed::run_backtest(&fx.candles, &fx.dataset, &cfg) {
            Ok(next_result) => {
                let trade_count = next_result.metrics.total_trades;
                let candle_count = fx.candles.len();
                result.set(Some(next_result.clone()));
                status.set(RunStatus::Success);
                let mut next_message = format!(
                    "Replay completed deterministically: {trade_count} closed trades across {candle_count} candles."
                );
                if fx.dataset.source == DatasetSource::BinanceRest {
                    if let Some(report) = active_gap_report.get() {
                        if report.gap_count > 0 {
                            next_message.push_str(&format!(
                                " Warning: {} data gap(s) detected ({} missing bars); results may be distorted.",
                                report.gap_count, report.missing_bars
                            ));
                        }
                    }
                }
                message.set(next_message);
                if let Some(cb) = on_result.clone() {
                    cb(next_result);
                }
            }
            Err(e) => {
                result.set(None);
                status.set(RunStatus::Error);
                message.set(e);
            }
        }
    };

    // TS focuses the results heading after a successful run.
    Effect::new(move |_| {
        if status.get() == RunStatus::Success {
            if let Some(el) = web_sys::window()
                .and_then(|w| w.document())
                .and_then(|d| d.get_element_by_id("backtest-results-title"))
            {
                if let Ok(html) = el.dyn_into::<web_sys::HtmlElement>() {
                    html.focus();
                }
            }
        }
    });

    let load_status_class = move || match load_state.get() {
        LoadState::Ready => "backtest-run-status backtest-run-status--success",
        LoadState::Error => "backtest-run-status backtest-run-status--error",
        _ => "backtest-run-status",
    };

    view! {
        <main id="strategy-lab-workspace" class="strategy-lab" tabindex="-1">
            <section class="strategy-lab__intro" aria-labelledby="strategy-lab-title">
                <div>
                    <span class="eyebrow">"RESEARCH WORKSPACE"</span>
                    <h2 id="strategy-lab-title">"Deterministic Strategy Lab"</h2>
                    <p>
                        "Validate a bounded SMA crossover against a verified fixture or real Binance history. "
                        "Signals use closed candles and execute at the next candle open."
                    </p>
                </div>
                <div class="strategy-lab__provenance" aria-label="Replay provenance">
                    <span>"NO LOOK-AHEAD"</span>
                    <span>"FIXED DATASET"</span>
                    <span>"EXPLICIT COSTS"</span>
                    <span>{move || source_chip()}</span>
                </div>
            </section>

            <div class="strategy-lab__grid">
                <aside class="backtest-setup" aria-labelledby="backtest-setup-title">
                    <div class="panel-title-row">
                        <h3 id="backtest-setup-title">"Backtest setup"</h3>
                        <span>"CONTRACT V1"</span>
                    </div>

                    <fieldset>
                        <legend>"Dataset source"</legend>
                        <div class="backtest-form-grid">
                            <label>
                                <input
                                    type="radio"
                                    name="dataset-source"
                                    value="FIXTURE"
                                    prop:checked=move || dataset_choice.get() == DatasetChoice::Fixture
                                    on:click=move |_| dataset_choice.set(DatasetChoice::Fixture)
                                />
                                <span>"Verified fixture"</span>
                            </label>
                            <label>
                                <input
                                    type="radio"
                                    name="dataset-source"
                                    value="BINANCE"
                                    prop:checked=move || dataset_choice.get() == DatasetChoice::Binance
                                    on:click=move |_| dataset_choice.set(DatasetChoice::Binance)
                                />
                                <span>"Binance history"</span>
                            </label>
                        </div>

                        <Show when=move || dataset_choice.get() == DatasetChoice::Binance>
                            <div class="backtest-form-grid">
                                <TextInput
                                    label="Symbol"
                                    aria_label="Binance symbol"
                                    value=binance_symbol
                                    wide=false
                                />
                                <label>
                                    <span>"Interval"</span>
                                    <select
                                        aria-label="Kline interval"
                                        prop:value=move || binance_interval.get()
                                        on:change=move |ev| {
                                            let v = event_target_value(&ev);
                                            // Narrow at the boundary like the TS guard.
                                            if typed::BACKTEST_TIMEFRAMES.contains(&v.as_str()) {
                                                binance_interval.set(v);
                                            }
                                        }
                                    >
                                        {typed::BACKTEST_TIMEFRAMES.iter().map(|tf| {
                                            view! { <option value=*tf>{*tf}</option> }
                                        }).collect::<Vec<_>>()}
                                    </select>
                                </label>
                                <ConfigNumberInput
                                    label="Lookback bars"
                                    aria_label="Lookback bars"
                                    min="2"
                                    max="50000"
                                    step="1"
                                    wide=true
                                    get=move || binance_lookback.get()
                                    set=move |v| binance_lookback.set(v)
                                />
                            </div>
                            <button
                                class="backtest-run-button"
                                type="button"
                                on:click=on_fetch_binance
                                prop:disabled=move || load_state.get() == LoadState::Loading
                            >
                                "Fetch Binance history"
                            </button>
                            <Show when=move || load_state.get() != LoadState::Idle>
                                <div
                                    class=load_status_class
                                    role=move || if load_state.get() == LoadState::Error { "alert" } else { "status" }
                                    aria-live="polite"
                                >
                                    {move || load_message.get()}
                                </div>
                            </Show>
                        </Show>
                    </fieldset>

                    <fieldset>
                        <legend>"Dataset"</legend>
                        <div class="dataset-card">
                            <div>
                                <strong>{move || active_fixture.get().dataset.name.clone()}</strong>
                                <span>
                                    {move || format!(
                                        "{} · {}",
                                        active_fixture.get().dataset.symbol,
                                        active_fixture.get().dataset.interval
                                    )}
                                </span>
                            </div>
                            <dl>
                                <div>
                                    <dt>"Candles"</dt>
                                    <dd>{move || active_fixture.get().dataset.candle_count}</dd>
                                </div>
                                <div>
                                    <dt>"Source"</dt>
                                    <dd>
                                        {move || if active_fixture.get().dataset.source == DatasetSource::SyntheticFixture {
                                            "Synthetic"
                                        } else {
                                            "Binance REST"
                                        }}
                                    </dd>
                                </div>
                                <div>
                                    <dt>"Checksum"</dt>
                                    <dd>{move || checksum_tail(&active_fixture.get().dataset.checksum).to_string()}</dd>
                                </div>
                                <div>
                                    <dt>"Span"</dt>
                                    <dd>
                                        {move || {
                                            let ds = &active_fixture.get().dataset;
                                            format!(
                                                "{} → {}",
                                                format_timestamp(ds.start_time),
                                                format_timestamp(ds.end_time)
                                            )
                                        }}
                                    </dd>
                                </div>
                            </dl>
                            {move || active_gap_report.get().map(|r| {
                                view! { <p class="field-help">{describe_gap_report(&r)}</p> }
                            })}
                        </div>
                        <p class="field-help">
                            {move || if active_fixture.get().dataset.source == DatasetSource::SyntheticFixture {
                                "Deterministic regime data validates execution and accounting only. It is not evidence of future or historical returns."
                            } else {
                                "Fetched history is replayed exactly as stored; gaps are reported and never filled."
                            }}
                        </p>
                    </fieldset>

                    <fieldset>
                        <legend>"Strategy · SMA crossover"</legend>
                        <div class="backtest-form-grid">
                            <ConfigNumberInput
                                label="Fast period"
                                aria_label="Fast SMA period"
                                min="2"
                                max=""
                                step="1"
                                wide=false
                                get=move || config.get().fast_period
                                set=move |v| config.update(|c| c.fast_period = v)
                            />
                            <ConfigNumberInput
                                label="Slow period"
                                aria_label="Slow SMA period"
                                min="3"
                                max=""
                                step="1"
                                wide=false
                                get=move || config.get().slow_period
                                set=move |v| config.update(|c| c.slow_period = v)
                            />
                        </div>
                        <p class="field-help">"Long when fast crosses above slow; flat on the reverse cross."</p>
                    </fieldset>

                    <fieldset>
                        <legend>"Capital and execution costs"</legend>
                        <ConfigNumberInput
                            label="Initial capital · USDT"
                            aria_label="Initial capital"
                            min="100"
                            max=""
                            step="100"
                            wide=true
                            get=move || config.get().initial_capital
                            set=move |v| config.update(|c| c.initial_capital = v)
                        />
                        <div class="backtest-form-grid">
                            <ConfigNumberInput
                                label="Taker fee · bps"
                                aria_label="Taker fee in basis points"
                                min="0"
                                max="1000"
                                step="1"
                                wide=false
                                get=move || config.get().fee_bps
                                set=move |v| config.update(|c| c.fee_bps = v)
                            />
                            <ConfigNumberInput
                                label="Slippage · bps"
                                aria_label="Slippage in basis points"
                                min="0"
                                max="1000"
                                step="1"
                                wide=false
                                get=move || config.get().slippage_bps
                                set=move |v| config.update(|c| c.slippage_bps = v)
                            />
                        </div>
                    </fieldset>

                    <button class="backtest-run-button" type="button" on:click=on_run_backtest>
                        "Run deterministic replay"
                    </button>

                    <div
                        class=move || format!("backtest-run-status backtest-run-status--{}", status.get().as_str())
                        role=move || if status.get() == RunStatus::Error { "alert" } else { "status" }
                        aria-live="polite"
                    >
                        {move || message.get()}
                    </div>
                </aside>

                <section class="backtest-results" aria-labelledby="backtest-results-title">
                    {move || {
                        let res = result.get();
                        match res {
                            None => view! {
                                <div class="backtest-empty-state">
                                    <h3 id="backtest-results-title">"No generated performance yet"</h3>
                                    <p>
                                        "Results appear only after you explicitly run the replay. The lab does "
                                        "not preload placeholder returns or simulated model evidence."
                                    </p>
                                    <ol>
                                        <li>"Inspect the dataset provenance."</li>
                                        <li>"Choose SMA periods and execution costs."</li>
                                        <li>"Run and inspect every generated trade."</li>
                                    </ol>
                                </div>
                            }.into_any(),
                            Some(res) => {
                                let metrics = res.metrics;
                                let dataset = res.dataset.clone();
                                let cfg = res.config;
                                let trades = res.trades.clone();
                                let warnings = res.diagnostics.warnings.clone();
                                let contract_version = res.contract_version.clone();
                                let engine_label = res.engine.clone();
                                let curve = res.equity_curve.clone();
                                let tab = active_tab.get();
                                view! {
                                    <div class="backtest-results__heading">
                                        <div>
                                            <span class="eyebrow">"LATEST COMPLETED RUN"</span>
                                            <h3 id="backtest-results-title" tabindex="-1">
                                                {format!(
                                                    "{} · SMA {}/{}",
                                                    dataset.symbol,
                                                    fmt_num(cfg.fast_period),
                                                    fmt_num(cfg.slow_period)
                                                )}
                                            </h3>
                                        </div>
                                        <span class="result-chip">
                                            {format!("DETERMINISTIC · {}", checksum_tail(&dataset.checksum))}
                                        </span>
                                    </div>

                                    <dl class="backtest-metrics">
                                        <div>
                                            <dt>"Total return"</dt>
                                            <dd class=move || if metrics.total_return_pct < 0.0 { "negative" } else { "positive" }>
                                                {signed_percent(metrics.total_return_pct)}
                                            </dd>
                                        </div>
                                        <div><dt>"Final equity"</dt><dd>{format_currency(metrics.final_equity, 2)}</dd></div>
                                        <div><dt>"Max drawdown"</dt><dd class="negative">{format!("-{:.2}%", metrics.max_drawdown_pct)}</dd></div>
                                        <div><dt>"Closed trades"</dt><dd>{metrics.total_trades}</dd></div>
                                        <div><dt>"Win rate"</dt><dd>{format!("{:.1}%", metrics.win_rate_pct)}</dd></div>
                                        <div><dt>{format!("Sharpe · {} annualized", dataset.interval)}</dt><dd>{format!("{:.2}", metrics.sharpe_ratio)}</dd></div>
                                        <div><dt>"Total fees"</dt><dd>{format_currency(metrics.total_fees, 2)}</dd></div>
                                        <div><dt>"Exposure"</dt><dd>{format!("{:.1}%", metrics.exposure_pct)}</dd></div>
                                    </dl>

                                    <EquityCurveChart points=curve/>

                                    <div class="backtest-result-tabs">
                                        <div class="tab-list" role="tablist" aria-label="Backtest result details">
                                            <button
                                                type="button"
                                                role="tab"
                                                aria-selected=move || active_tab.get() == "trades"
                                                class=move || if active_tab.get() == "trades" { "tab-button active" } else { "tab-button" }
                                                on:click=move |_| active_tab.set("trades")
                                            >
                                                {format!("Trades ({})", trades.len())}
                                            </button>
                                            <button
                                                type="button"
                                                role="tab"
                                                aria-selected=move || active_tab.get() == "diagnostics"
                                                class=move || if active_tab.get() == "diagnostics" { "tab-button active" } else { "tab-button" }
                                                on:click=move |_| active_tab.set("diagnostics")
                                            >
                                                "Diagnostics"
                                            </button>
                                        </div>
                                        <Show when=move || tab == "trades">
                                            <div class="backtest-trade-log" role="tabpanel">
                                                <table class="terminal-table">
                                                    <thead>
                                                        <tr>
                                                            <th>"Trade"</th>
                                                            <th>"Entry UTC"</th>
                                                            <th>"Exit UTC"</th>
                                                            <th>"Entry"</th>
                                                            <th>"Exit"</th>
                                                            <th>"Bars"</th>
                                                            <th>"Fees"</th>
                                                            <th>"Net P&L"</th>
                                                            <th>"Reason"</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {trades.iter().map(|trade| {
                                                            let pnl_class = if trade.net_pnl >= 0.0 { "positive" } else { "negative" };
                                                            let reason = match trade.exit_reason {
                                                                typed::ExitReason::Signal => "SIGNAL",
                                                                typed::ExitReason::EndOfData => "END_OF_DATA",
                                                            };
                                                            view! {
                                                                <tr>
                                                                    <td>{trade.id.clone()}</td>
                                                                    <td>{format_timestamp(trade.entry_time)}</td>
                                                                    <td>{format_timestamp(trade.exit_time)}</td>
                                                                    <td>{format_price(trade.entry_price)}</td>
                                                                    <td>{format_price(trade.exit_price)}</td>
                                                                    <td>{trade.bars_held}</td>
                                                                    <td>{format_currency(trade.entry_fee + trade.exit_fee, 2)}</td>
                                                                    <td class=pnl_class>{format_currency(trade.net_pnl, 2)}</td>
                                                                    <td>{reason}</td>
                                                                </tr>
                                                            }
                                                        }).collect::<Vec<_>>()}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </Show>
                                        <Show when=move || tab == "diagnostics">
                                            <div class="backtest-diagnostics" role="tabpanel">
                                                <dl>
                                                    <div><dt>"Contract"</dt><dd>{contract_version.clone()}</dd></div>
                                                    <div><dt>"Runtime"</dt><dd>{engine_label.clone()}</dd></div>
                                                    <div><dt>"Reference"</dt><dd>"TypeScript reference engine"</dd></div>
                                                    <div><dt>"Execution"</dt><dd>"Signal close → next bar open"</dd></div>
                                                    <div><dt>"Fill model"</dt><dd>"Market price with adverse bps costs"</dd></div>
                                                    <div><dt>"Dataset checksum"</dt><dd>{dataset.checksum.clone()}</dd></div>
                                                </dl>
                                                <ul>
                                                    {warnings.iter().map(|w| view! { <li>{w.clone()}</li> }).collect::<Vec<_>>()}
                                                </ul>
                                            </div>
                                        </Show>
                                    </div>
                                }.into_any()
                            }
                        }
                    }}
                </section>
            </div>
        </main>
    }
}
