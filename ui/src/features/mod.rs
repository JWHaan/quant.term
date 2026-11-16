pub mod analytics;
pub mod backtest;
pub mod charts;
pub mod command_palette;
pub mod debug;
pub mod market;
pub mod news;
pub mod trading;

use crate::ui::chrome::{
    DashboardPanel, MarketOverviewBar, PanelSize, ResizeHandle, TabDef, TabPanel,
};
use leptos::prelude::*;
use market::{
    AlertPanel, LiquidationFeed, MarketGrid, MicrostructureRibbon, OrderBookDOM,
};
use news::{NetworkPulsePanel, NewsFeed, NewsTicker};
use trading::PaperTradingPanel;

#[component]
pub fn MonitorWorkspace(
    selected_symbol: impl Fn() -> String + Copy + Send + Sync + 'static,
    is_global_connected: impl Fn() -> bool + Copy + Send + Sync + 'static,
    on_select_symbol: impl Fn(String) + Copy + Send + Sync + 'static,
) -> impl IntoView {
    let symbol_memo = Memo::new(move |_| selected_symbol());
    let connected_memo = Memo::new(move |_| is_global_connected());

    let market_depth_tabs = vec![
        TabDef {
            id: "orderbook",
            label: "Order Book".to_string(),
            content: view! { <OrderBookDOM symbol=Some(symbol_memo) /> }.into_any(),
        },
        TabDef {
            id: "liquidations",
            label: "Liquidations".to_string(),
            content: view! { <LiquidationFeed symbol=Some(symbol_memo) /> }.into_any(),
        },
    ];

    let research_tabs = vec![
        TabDef {
            id: "signal",
            label: "Signal".to_string(),
            content: view! { <analytics::quant_signal::QuantSignalEngine /> }.into_any(),
        },
        TabDef {
            id: "factors",
            label: "Factors".to_string(),
            content: view! { <analytics::alpha_panel::AlphaPanel symbol=Some(symbol_memo) interval=None /> }.into_any(),
        },
    ];

    let intelligence_tabs = vec![
        TabDef {
            id: "portfolio",
            label: "Paper".to_string(),
            content: view! { <PaperTradingPanel symbol=selected_symbol /> }.into_any(),
        },
        TabDef {
            id: "network",
            label: "Network".to_string(),
            content: view! { <NetworkPulsePanel /> }.into_any(),
        },
        TabDef {
            id: "alerts",
            label: "Alerts".to_string(),
            content: view! { <AlertPanel symbol=symbol_memo /> }.into_any(),
        },
        TabDef {
            id: "news",
            label: "News Feed".to_string(),
            content: view! { <NewsFeed symbol=selected_symbol /> }.into_any(),
        },
    ];

    let chart_title = Memo::new(move |_| format!("Chart - {}", selected_symbol()));
    let ribbon_title = Memo::new(move |_| format!("Microstructure - {}", selected_symbol()));

    // Panel sizes (%) — same defaults/bounds as the React react-resizable-panels layout.
    let left = RwSignal::new(18.0f64);
    let center = RwSignal::new(57.0f64);
    let right = RwSignal::new(25.0f64);
    let chart = RwSignal::new(54.0f64);
    let ribbon = RwSignal::new(14.0f64);
    let depth = RwSignal::new(32.0f64);
    let research = RwSignal::new(52.0f64);
    let intel = RwSignal::new(48.0f64);
    // flex grow-share (percent value) with zero basis; basis/mins come from CSS.
    let grow = |s: RwSignal<f64>| move || format!("flex:{} 1 0%", s.get());
    let ps = |v: RwSignal<f64>, min: f64, max: f64| PanelSize {
        value: v,
        min,
        max,
    };
    let left_ps = ps(left, 14.0, 25.0);
    let center_ps = ps(center, 42.0, 100.0);
    let right_ps = ps(right, 20.0, 35.0);
    let chart_ps = ps(chart, 40.0, 100.0);
    let ribbon_ps = ps(ribbon, 10.0, 100.0);
    let depth_ps = ps(depth, 20.0, 100.0);
    let research_ps = ps(research, 0.0, 100.0);
    let intel_ps = ps(intel, 0.0, 100.0);

    view! {
        <MarketOverviewBar symbol=symbol_memo is_connected=connected_memo />
        <NewsTicker />
        <main class="main-content monitor-workspace" id="terminal-workspace" tabindex="-1">
            <div id="panel-market-watch" tabindex="-1" class="monitor-cell" style=grow(left)>
                <DashboardPanel title=move || "Market Watch".to_string() >
                    <MarketGrid on_select_symbol=Some(on_select_symbol) />
                </DashboardPanel>
            </div>
            <ResizeHandle a=left_ps b=center_ps orientation="vertical" />
            <div class="monitor-cell monitor-center" style=grow(center)>
                <div id="panel-chart" tabindex="-1" class="monitor-cell" style=grow(chart)>
                    <DashboardPanel title=move || chart_title.get()>
                        <charts::ChartContainer symbol=symbol_memo />
                    </DashboardPanel>
                </div>
                <ResizeHandle a=chart_ps b=ribbon_ps orientation="horizontal" />
                <div id="panel-ribbon" tabindex="-1" class="monitor-cell monitor-ribbon" style=grow(ribbon)>
                    <DashboardPanel title=move || ribbon_title.get()>
                        <MicrostructureRibbon symbol=symbol_memo />
                    </DashboardPanel>
                </div>
                <ResizeHandle a=ribbon_ps b=depth_ps orientation="horizontal" />
                <div class="monitor-cell monitor-depth" style=grow(depth)>
                    <DashboardPanel title=move || "Market Depth".to_string()>
                        <TabPanel tabs=market_depth_tabs default_tab="orderbook" />
                    </DashboardPanel>
                </div>
            </div>
            <ResizeHandle a=center_ps b=right_ps orientation="vertical" />
            <div class="monitor-cell monitor-right" style=grow(right)>
                <div id="panel-research" tabindex="-1" class="monitor-cell" style=grow(research)>
                    <DashboardPanel title=move || "Research Monitor".to_string()>
                        <TabPanel tabs=research_tabs default_tab="signal" />
                    </DashboardPanel>
                </div>
                <ResizeHandle a=research_ps b=intel_ps orientation="horizontal" />
                <div id="panel-intelligence" tabindex="-1" class="monitor-cell" style=grow(intel)>
                    <DashboardPanel title=move || "Market Intelligence".to_string()>
                        <TabPanel tabs=intelligence_tabs default_tab="portfolio" />
                    </DashboardPanel>
                </div>
            </div>
        </main>
    }
}

#[cfg(target_arch = "wasm32")]
pub use backtest::strategy_lab::StrategyLab;
