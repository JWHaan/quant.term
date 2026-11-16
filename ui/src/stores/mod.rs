//! Global application stores — the Rust equivalent of the Zustand stores.
//! Signals are provided via context at the root; actions are methods on
//! `AppStores` so components get `let stores = use_stores();` like before.

use leptos::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ─── Constants (mirror src/constants/config.ts) ──────────────────────────────

pub const BINANCE_REST_URL: &str = "https://data-api.binance.vision";
pub const BINANCE_WS_URL: &str = "wss://data-stream.binance.vision";
pub const BINANCE_FUTURES_REST_URL: &str = "https://fapi.binance.com";
pub const BINANCE_FUTURES_WS_URL: &str = "wss://fstream.binance.com/ws";

pub const WS_HEARTBEAT_INTERVAL_MS: f64 = 30_000.0;
pub const WS_MAX_RECONNECT_ATTEMPTS: u32 = 10;
pub const WS_INITIAL_RECONNECT_DELAY_MS: f64 = 1_000.0;
pub const WS_MAX_RECONNECT_DELAY_MS: f64 = 30_000.0;
pub const WS_SYMBOLS_PER_CONNECTION: usize = 10;
pub const WS_MESSAGE_BATCH_INTERVAL_MS: f64 = 50.0;
pub const MARKET_POLL_INTERVAL_MS: f64 = 15_000.0;
pub const DEFAULT_SYMBOL: &str = "BTCUSDT";
pub const DEFAULT_WATCHLIST: [&str; 5] = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "ADAUSDT"];
pub const BINANCE_MAX_MESSAGES_PER_SECOND: u32 = 5;
pub const BINANCE_MAX_CONNECTIONS_PER_5MIN: u32 = 300;
pub const STALE_CONNECTION_THRESHOLD_MS: f64 = 60_000.0;

/// Display latency thresholds (ms) — mirrors `LATENCY_THRESHOLDS` in
/// src/constants/config.ts. Note: connection-quality classification uses the
/// tighter 50/100/200ms bands in services::hooks, same as the TS app.
pub const LATENCY_THRESHOLD_EXCELLENT_MS: f64 = 100.0;
pub const LATENCY_THRESHOLD_GOOD_MS: f64 = 250.0;
pub const LATENCY_THRESHOLD_FAIR_MS: f64 = 500.0;

fn spot_alias(symbol: &str) -> Option<&'static str> {
    match symbol {
        "MATICUSDT" => Some("POLUSDT"),
        "RNDRUSDT" => Some("RENDERUSDT"),
        "MKRUSDT" => Some("SKYUSDT"),
        "FTMUSDT" => Some("SUSDT"),
        _ => None,
    }
}

fn futures_alias(symbol: &str) -> Option<&'static str> {
    match symbol {
        "SHIBUSDT" => Some("1000SHIBUSDT"),
        _ => None,
    }
}

pub fn normalize_binance_spot_symbol(symbol: &str) -> String {
    let normalized = symbol.to_uppercase();
    spot_alias(&normalized)
        .map(str::to_string)
        .unwrap_or(normalized)
}

pub fn to_binance_futures_symbol(symbol: &str) -> String {
    let spot = normalize_binance_spot_symbol(symbol);
    futures_alias(&spot).map(str::to_string).unwrap_or(spot)
}

// ─── Time / random helpers ───────────────────────────────────────────────────

pub fn now_ms() -> f64 {
    #[cfg(target_arch = "wasm32")]
    {
        js_sys::Date::now()
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs_f64() * 1000.0)
            .unwrap_or(0.0)
    }
}

fn random_suffix(len: usize) -> String {
    #[cfg(target_arch = "wasm32")]
    {
        let rand = js_sys::Math::random();
        let s = format!("{:.8}", rand).replace('.', "");
        s.chars().take(len).collect()
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        use std::sync::atomic::{AtomicU64, Ordering};
        static COUNTER: AtomicU64 = AtomicU64::new(0);
        let n = COUNTER.fetch_add(1, Ordering::Relaxed);
        format!("{:0width$x}", n, width = len)
    }
}

// ─── Domain types ────────────────────────────────────────────────────────────

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Ohlcv {
    pub time: f64,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
}

impl Serialize for Ohlcv {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeStruct;
        let mut st = s.serialize_struct("OHLCV", 6)?;
        st.serialize_field("time", &self.time)?;
        st.serialize_field("open", &self.open)?;
        st.serialize_field("high", &self.high)?;
        st.serialize_field("low", &self.low)?;
        st.serialize_field("close", &self.close)?;
        st.serialize_field("volume", &self.volume)?;
        st.end()
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketData {
    pub symbol: String,
    pub price: f64,
    pub price_change: f64,
    pub price_change_percent: f64,
    pub volume: f64,
    pub quote_volume: f64,
    pub high: f64,
    pub low: f64,
    pub timestamp: f64,
}

impl Default for MarketData {
    fn default() -> Self {
        Self {
            symbol: String::new(),
            price: 0.0,
            price_change: 0.0,
            price_change_percent: 0.0,
            volume: 0.0,
            quote_volume: 0.0,
            high: 0.0,
            low: 0.0,
            timestamp: 0.0,
        }
    }
}

/// Partial market-data update (TS `Partial<MarketData>`).
#[derive(Clone, Debug, Default)]
pub struct MarketDataUpdate {
    pub price: Option<f64>,
    pub price_change: Option<f64>,
    pub price_change_percent: Option<f64>,
    pub volume: Option<f64>,
    pub quote_volume: Option<f64>,
    pub high: Option<f64>,
    pub low: Option<f64>,
    pub timestamp: Option<f64>,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct SeriesMeta {
    pub is_loading: bool,
    pub last_updated: Option<f64>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct OrderBookSnapshot {
    pub timestamp: f64,
    /// (price, size) pairs — TS used Map<number, number>.
    pub bids: Vec<(f64, f64)>,
    pub asks: Vec<(f64, f64)>,
    pub symbol: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum PaperSide {
    Long,
    Short,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaperPosition {
    pub id: String,
    pub symbol: String,
    pub side: PaperSide,
    pub quantity: f64,
    pub leverage: i64,
    pub entry_price: f64,
    pub current_price: f64,
    pub opened_at: f64,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaperTrade {
    #[serde(flatten)]
    pub position: PaperPosition,
    pub exit_price: f64,
    pub closed_at: f64,
    pub realized_pnl: f64,
}

// ─── Alerts ──────────────────────────────────────────────────────────────────

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AlertType {
    Price,
    Indicator,
    Volume,
    Ofi,
    Signal,
    Liquidation,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AlertCondition {
    Above,
    Below,
    Equals,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AlertIndicator {
    Rsi,
    Macd,
    VolumeRatio,
    Ofi,
    Liquidation,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum AlertValue {
    Num(f64),
    Str(String),
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Alert {
    pub id: String,
    pub symbol: String,
    #[serde(rename = "type")]
    pub alert_type: AlertType,
    pub condition: AlertCondition,
    pub value: AlertValue,
    pub message: String,
    pub enabled: bool,
    pub triggered: bool,
    pub created_at: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_triggered: Option<f64>,
    pub sound_enabled: bool,
    pub notification_enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub indicator: Option<AlertIndicator>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlertHistoryEntry {
    #[serde(flatten)]
    pub alert: Alert,
    pub triggered_at: f64,
}

/// Input for creating an alert (TS `Omit<Alert, 'id'|'createdAt'|'triggered'>`).
#[derive(Clone, Debug)]
pub struct NewAlert {
    pub symbol: String,
    pub alert_type: AlertType,
    pub condition: AlertCondition,
    pub value: AlertValue,
    pub message: String,
    pub enabled: bool,
    pub sound_enabled: bool,
    pub notification_enabled: bool,
    pub indicator: Option<AlertIndicator>,
}

/// Optional indicator/market fields checked by alerts.
#[derive(Clone, Debug, Default)]
pub struct MarketConditionData {
    pub rsi: Option<f64>,
    pub macd: Option<f64>,
    pub volume_ratio: Option<f64>,
    pub signal: Option<String>,
    pub ofi: Option<f64>,
    pub liquidation: Option<f64>,
}

// ─── App state ───────────────────────────────────────────────────────────────

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum WorkspaceMode {
    Monitor,
    StrategyLab,
}

impl WorkspaceMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            WorkspaceMode::Monitor => "monitor",
            WorkspaceMode::StrategyLab => "strategy-lab",
        }
    }

    fn from_str(s: &str) -> Self {
        if s == "strategy-lab" {
            WorkspaceMode::StrategyLab
        } else {
            WorkspaceMode::Monitor
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ConnectionStatus {
    Disconnected,
    Connecting,
    Connected,
    Error,
    Reconnecting,
}

impl ConnectionStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            ConnectionStatus::Disconnected => "disconnected",
            ConnectionStatus::Connecting => "connecting",
            ConnectionStatus::Connected => "connected",
            ConnectionStatus::Error => "error",
            ConnectionStatus::Reconnecting => "reconnecting",
        }
    }
}

/// Global application stores — provided via context at the root.
#[derive(Clone, Copy)]
pub struct AppStores {
    // UI shell
    pub selected_symbol: RwSignal<String>,
    pub workspace: RwSignal<WorkspaceMode>,
    pub is_fullscreen: RwSignal<bool>,
    pub show_command_palette: RwSignal<bool>,
    pub show_help: RwSignal<bool>,

    // connectionStore
    pub connections: RwSignal<HashMap<String, ConnectionStatus>>,

    // marketStore (persisted: selectedSymbol + watchlist under "market-store")
    pub watchlist: RwSignal<Vec<String>>,
    pub market_data: RwSignal<HashMap<String, MarketData>>,
    pub last_update: RwSignal<Option<f64>>,

    // chartDataStore
    pub candles: RwSignal<HashMap<String, HashMap<String, Vec<Ohlcv>>>>,
    pub series_meta: RwSignal<HashMap<String, HashMap<String, SeriesMeta>>>,
    pub max_candles: RwSignal<usize>,

    // orderBookHistoryStore
    pub ob_snapshots: RwSignal<Vec<OrderBookSnapshot>>,
    pub ob_max_snapshots: RwSignal<usize>,
    pub ob_capture_interval_ms: RwSignal<f64>,
    pub ob_last_capture_ms: RwSignal<f64>,

    // portfolioStore (persisted under "quant-term-paper-portfolio")
    pub starting_balance: RwSignal<f64>,
    pub realized_pnl: RwSignal<f64>,
    pub positions: RwSignal<Vec<PaperPosition>>,
    pub trades: RwSignal<Vec<PaperTrade>>,

    // alertStore (persisted under "alert-store", alerts only)
    pub alerts: RwSignal<Vec<Alert>>,
    pub triggered_alerts: RwSignal<Vec<String>>,
    pub alert_history: RwSignal<Vec<AlertHistoryEntry>>,
}

// ─── localStorage persistence (zustand-compatible shapes) ────────────────────

#[cfg(target_arch = "wasm32")]
fn storage_get(key: &str) -> Option<String> {
    web_sys::window()?
        .local_storage()
        .ok()
        .flatten()?
        .get_item(key)
        .ok()?
}

#[cfg(target_arch = "wasm32")]
fn storage_set(key: &str, value: &str) {
    if let Some(storage) = web_sys::window().and_then(|w| w.local_storage().ok().flatten()) {
        let _ = storage.set_item(key, value);
    }
}

#[cfg(not(target_arch = "wasm32"))]
fn storage_get(_key: &str) -> Option<String> {
    None
}

#[cfg(not(target_arch = "wasm32"))]
fn storage_set(_key: &str, _value: &str) {}

#[derive(Deserialize)]
struct PersistedMarket {
    state: Option<PersistedMarketState>,
}

#[derive(Deserialize)]
struct PersistedMarketState {
    #[serde(rename = "selectedSymbol")]
    selected_symbol: Option<String>,
    watchlist: Option<Vec<String>>,
}

#[derive(Deserialize)]
struct PersistedPortfolio {
    state: Option<PersistedPortfolioState>,
}

#[derive(Deserialize, Serialize)]
struct PersistedPortfolioState {
    #[serde(rename = "startingBalance")]
    starting_balance: Option<f64>,
    #[serde(rename = "realizedPnl")]
    realized_pnl: Option<f64>,
    positions: Option<Vec<PaperPosition>>,
    trades: Option<Vec<PaperTrade>>,
}

#[derive(Deserialize)]
struct PersistedAlerts {
    state: Option<PersistedAlertsState>,
}

#[derive(Deserialize)]
struct PersistedAlertsState {
    alerts: Option<Vec<Alert>>,
}

fn load_market_persisted() -> (String, Vec<String>) {
    let raw = storage_get("market-store");
    let parsed: Option<PersistedMarket> = raw.and_then(|s| serde_json::from_str(&s).ok());
    match parsed.and_then(|p| p.state) {
        Some(state) => {
            let symbol = state
                .selected_symbol
                .map(|s| normalize_binance_spot_symbol(&s))
                .unwrap_or_else(|| DEFAULT_SYMBOL.to_string());
            let watchlist = dedup_preserve_order(
                state
                    .watchlist
                    .unwrap_or_else(|| DEFAULT_WATCHLIST.iter().map(|s| s.to_string()).collect())
                    .iter()
                    .map(|s| normalize_binance_spot_symbol(s))
                    .collect(),
            );
            (symbol, watchlist)
        }
        None => (
            DEFAULT_SYMBOL.to_string(),
            DEFAULT_WATCHLIST.iter().map(|s| s.to_string()).collect(),
        ),
    }
}

fn dedup_preserve_order(items: Vec<String>) -> Vec<String> {
    let mut seen = std::collections::HashSet::new();
    items
        .into_iter()
        .filter(|s| seen.insert(s.clone()))
        .collect()
}

fn load_portfolio_persisted() -> Option<PersistedPortfolioState> {
    let raw = storage_get("quant-term-paper-portfolio")?;
    let parsed: PersistedPortfolio = serde_json::from_str(&raw).ok()?;
    parsed.state
}

fn load_alerts_persisted() -> Vec<Alert> {
    let raw = storage_get("alert-store");
    let parsed: Option<PersistedAlerts> = raw.and_then(|s| serde_json::from_str(&s).ok());
    parsed
        .and_then(|p| p.state)
        .and_then(|s| s.alerts)
        .unwrap_or_default()
}

// ─── Store provisioning ──────────────────────────────────────────────────────

const DEFAULT_MAX_CANDLES: usize = 1800;
const HARD_CAP_MAX_CANDLES: usize = 10_000;
const DEFAULT_MAX_OB_SNAPSHOTS: usize = 300;
const DEFAULT_OB_CAPTURE_INTERVAL_MS: f64 = 1000.0;

pub fn provide_stores() -> AppStores {
    // Workspace selection (persisted under "quant-term-workspace")
    let workspace = RwSignal::new(
        storage_get("quant-term-workspace")
            .map(|s| WorkspaceMode::from_str(&s))
            .unwrap_or(WorkspaceMode::Monitor),
    );

    // Market store with zustand-compatible persistence.
    let (saved_symbol, saved_watchlist) = load_market_persisted();
    let selected_symbol = RwSignal::new(saved_symbol);
    let watchlist = RwSignal::new(saved_watchlist);
    let market_data = RwSignal::new(HashMap::new());
    let last_update = RwSignal::new(None::<f64>);

    // Chart data store.
    let candles = RwSignal::new(HashMap::new());
    let series_meta = RwSignal::new(HashMap::new());
    let max_candles = RwSignal::new(DEFAULT_MAX_CANDLES);

    // Order book history store.
    let ob_snapshots = RwSignal::new(Vec::new());
    let ob_max_snapshots = RwSignal::new(DEFAULT_MAX_OB_SNAPSHOTS);
    let ob_capture_interval_ms = RwSignal::new(DEFAULT_OB_CAPTURE_INTERVAL_MS);
    let ob_last_capture_ms = RwSignal::new(0.0);

    // Portfolio store with persistence.
    let persisted = load_portfolio_persisted();
    let starting_balance = RwSignal::new(
        persisted
            .as_ref()
            .and_then(|p| p.starting_balance)
            .filter(|b| b.is_finite() && *b > 0.0)
            .unwrap_or(100_000.0),
    );
    let realized_pnl = RwSignal::new(
        persisted
            .as_ref()
            .and_then(|p| p.realized_pnl)
            .unwrap_or(0.0),
    );
    let positions = RwSignal::new(
        persisted
            .as_ref()
            .and_then(|p| p.positions.clone())
            .unwrap_or_default(),
    );
    let trades = RwSignal::new(
        persisted
            .as_ref()
            .and_then(|p| p.trades.clone())
            .unwrap_or_default(),
    );

    // Alert store with persistence (triggered flags reset on hydrate, like TS).
    let mut persisted_alerts = load_alerts_persisted();
    for alert in &mut persisted_alerts {
        alert.triggered = false;
        alert.last_triggered = None;
    }
    let alerts = RwSignal::new(persisted_alerts);
    let triggered_alerts = RwSignal::new(Vec::new());
    let alert_history = RwSignal::new(Vec::new());

    let stores = AppStores {
        selected_symbol,
        workspace,
        is_fullscreen: RwSignal::new(false),
        show_command_palette: RwSignal::new(false),
        show_help: RwSignal::new(false),
        connections: RwSignal::new(HashMap::from([
            ("binance".to_string(), ConnectionStatus::Disconnected),
            ("marketData".to_string(), ConnectionStatus::Disconnected),
            ("futures".to_string(), ConnectionStatus::Disconnected),
            ("depth".to_string(), ConnectionStatus::Disconnected),
            ("trades".to_string(), ConnectionStatus::Disconnected),
        ])),
        watchlist,
        market_data,
        last_update,
        candles,
        series_meta,
        max_candles,
        ob_snapshots,
        ob_max_snapshots,
        ob_capture_interval_ms,
        ob_last_capture_ms,
        starting_balance,
        realized_pnl,
        positions,
        trades,
        alerts,
        triggered_alerts,
        alert_history,
    };

    // Persist workspace + market selection + portfolio + alerts on change.
    Effect::new(move |_| {
        let mode = workspace.get();
        storage_set("quant-term-workspace", mode.as_str());
    });

    Effect::new(move |_| {
        let symbol = selected_symbol.get();
        let list = watchlist.get();
        let payload = serde_json::json!({
            "state": {
                "selectedSymbol": symbol,
                "watchlist": list,
            },
            "version": 0,
        });
        storage_set("market-store", &payload.to_string());
    });

    Effect::new(move |_| {
        let starting = starting_balance.get();
        let pnl = realized_pnl.get();
        let pos = positions.get();
        let trd = trades.get();
        let payload = serde_json::json!({
            "state": {
                "startingBalance": starting,
                "realizedPnl": pnl,
                "positions": pos,
                "trades": trd,
            },
            "version": 0,
        });
        storage_set("quant-term-paper-portfolio", &payload.to_string());
    });

    Effect::new(move |_| {
        let list = alerts.get();
        let payload = serde_json::json!({
            "state": {
                "alerts": list.iter().map(|a| {
                    let mut v = serde_json::to_value(a).unwrap_or_default();
                    if let Some(obj) = v.as_object_mut() {
                        obj.insert("triggered".to_string(), serde_json::json!(false));
                    }
                    v
                }).collect::<Vec<_>>(),
            },
            "version": 0,
        });
        storage_set("alert-store", &payload.to_string());
    });

    provide_context(stores);
    stores
}

pub fn use_stores() -> AppStores {
    expect_context::<AppStores>()
}

// ─── Actions ─────────────────────────────────────────────────────────────────

impl AppStores {
    // connectionStore
    pub fn set_connection_status(&self, source: &str, status: ConnectionStatus) {
        self.connections.update(|c| {
            c.insert(source.to_string(), status);
        });
    }

    // marketStore
    pub fn set_symbol(&self, symbol: &str) {
        self.selected_symbol
            .set(normalize_binance_spot_symbol(symbol));
    }

    pub fn add_to_watchlist(&self, symbol: &str) {
        let normalized = normalize_binance_spot_symbol(symbol);
        self.watchlist.update(|list| {
            if !list.contains(&normalized) {
                list.push(normalized);
            }
        });
    }

    pub fn remove_from_watchlist(&self, symbol: &str) {
        let normalized = normalize_binance_spot_symbol(symbol);
        self.watchlist
            .update(|list| list.retain(|s| *s != normalized));
    }

    pub fn reorder_watchlist(&self, from_index: usize, to_index: usize) {
        self.watchlist.update(|list| {
            if from_index >= list.len() {
                return;
            }
            let removed = list.remove(from_index);
            let idx = to_index.min(list.len());
            list.insert(idx, removed);
        });
    }

    pub fn update_market_data(&self, symbol: &str, data: MarketDataUpdate) {
        let normalized = normalize_binance_spot_symbol(symbol);
        let now = now_ms();
        self.market_data.update(|map| {
            let entry = map.entry(normalized.clone()).or_default();
            if let Some(v) = data.price {
                entry.price = v;
            }
            if let Some(v) = data.price_change {
                entry.price_change = v;
            }
            if let Some(v) = data.price_change_percent {
                entry.price_change_percent = v;
            }
            if let Some(v) = data.volume {
                entry.volume = v;
            }
            if let Some(v) = data.quote_volume {
                entry.quote_volume = v;
            }
            if let Some(v) = data.high {
                entry.high = v;
            }
            if let Some(v) = data.low {
                entry.low = v;
            }
            entry.symbol = normalized.clone();
            entry.timestamp = match data.timestamp {
                Some(t) if t > 0.0 => t,
                _ => now,
            };
        });
        self.last_update.set(Some(now));
    }

    pub fn clear_market_data(&self) {
        self.market_data.set(HashMap::new());
        self.last_update.set(None);
    }

    pub fn get_market_data(&self, symbol: &str) -> Option<MarketData> {
        let normalized = normalize_binance_spot_symbol(symbol);
        self.market_data.with(|map| map.get(&normalized).cloned())
    }

    pub fn is_in_watchlist(&self, symbol: &str) -> bool {
        let normalized = normalize_binance_spot_symbol(symbol);
        self.watchlist.with(|list| list.contains(&normalized))
    }

    // chartDataStore
    pub fn set_max_candles(&self, max: usize) {
        assert!(max > 0, "maxCandles must be a positive finite number");
        self.max_candles.set(max.min(HARD_CAP_MAX_CANDLES));
    }

    fn normalize_candles(candles: &[Ohlcv]) -> Vec<Ohlcv> {
        // Dedup by time (last wins), sort ascending — mirrors TS normalizeCandles.
        let mut map: HashMap<i64, Ohlcv> = HashMap::new();
        for c in candles {
            if c.time.is_finite() {
                map.insert(c.time as i64, *c);
            }
        }
        let mut out: Vec<Ohlcv> = map.into_values().collect();
        out.sort_by(|a, b| {
            a.time
                .partial_cmp(&b.time)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        out
    }

    fn clamp_candles(candles: Vec<Ohlcv>, max: usize) -> Vec<Ohlcv> {
        if candles.len() <= max {
            candles
        } else {
            candles[candles.len() - max..].to_vec()
        }
    }

    pub fn set_series_loading(&self, symbol: &str, interval: &str, is_loading: bool) {
        let sym = symbol.to_uppercase();
        self.series_meta.update(|meta| {
            let entry = meta
                .entry(sym.clone())
                .or_default()
                .entry(interval.to_string())
                .or_insert(SeriesMeta {
                    is_loading: false,
                    last_updated: None,
                });
            entry.is_loading = is_loading;
        });
    }

    pub fn set_historical_candles(&self, symbol: &str, interval: &str, candles: Vec<Ohlcv>) {
        let sym = symbol.to_uppercase();
        let max = self.max_candles.get_untracked();
        let normalized = Self::clamp_candles(Self::normalize_candles(&candles), max);
        let has_candles = !normalized.is_empty();
        self.candles.update(|state| {
            state
                .entry(sym.clone())
                .or_default()
                .insert(interval.to_string(), normalized.clone());
        });
        self.series_meta.update(|meta| {
            let entry = meta
                .entry(sym)
                .or_default()
                .entry(interval.to_string())
                .or_insert(SeriesMeta {
                    is_loading: false,
                    last_updated: None,
                });
            entry.is_loading = false;
            if has_candles {
                entry.last_updated = Some(now_ms());
            }
        });
    }

    pub fn upsert_candle(&self, symbol: &str, interval: &str, candle: Ohlcv) {
        let sym = symbol.to_uppercase();
        let max = self.max_candles.get_untracked();
        self.candles.update(|state| {
            let series = state
                .entry(sym.clone())
                .or_default()
                .entry(interval.to_string())
                .or_default();
            series.push(candle);
            let normalized = Self::clamp_candles(Self::normalize_candles(series), max);
            *series = normalized;
        });
        self.series_meta.update(|meta| {
            let entry = meta
                .entry(sym)
                .or_default()
                .entry(interval.to_string())
                .or_insert(SeriesMeta {
                    is_loading: false,
                    last_updated: None,
                });
            entry.is_loading = false;
            entry.last_updated = Some(now_ms());
        });
    }

    pub fn clear_candles(&self, symbol: Option<&str>, interval: Option<&str>) {
        match (symbol, interval) {
            (None, _) => {
                self.candles.set(HashMap::new());
                self.series_meta.set(HashMap::new());
            }
            (Some(sym), None) => {
                let sym = sym.to_uppercase();
                self.candles.update(|c| {
                    c.remove(&sym);
                });
                self.series_meta.update(|m| {
                    m.remove(&sym);
                });
            }
            (Some(sym), Some(iv)) => {
                let sym = sym.to_uppercase();
                let iv = iv.to_string();
                self.candles.update(|c| {
                    if let Some(inner) = c.get_mut(&sym) {
                        inner.remove(&iv);
                        if inner.is_empty() {
                            c.remove(&sym);
                        }
                    }
                });
                self.series_meta.update(|m| {
                    if let Some(inner) = m.get_mut(&sym) {
                        inner.remove(&iv);
                        if inner.is_empty() {
                            m.remove(&sym);
                        }
                    }
                });
            }
        }
    }

    pub fn get_candles(&self, symbol: &str, interval: &str) -> Vec<Ohlcv> {
        let sym = symbol.to_uppercase();
        self.candles.with(|c| {
            c.get(&sym)
                .and_then(|inner| inner.get(interval))
                .cloned()
                .unwrap_or_default()
        })
    }

    // orderBookHistoryStore
    pub fn add_ob_snapshot(&self, snapshot: OrderBookSnapshot) {
        let now = now_ms();
        let interval = self.ob_capture_interval_ms.get_untracked();
        let last = self.ob_last_capture_ms.get_untracked();
        if now - last < interval {
            return;
        }
        let max = self.ob_max_snapshots.get_untracked();
        self.ob_snapshots.update(|snaps| {
            snaps.push(snapshot);
            if snaps.len() > max {
                let excess = snaps.len() - max;
                snaps.drain(0..excess);
            }
        });
        self.ob_last_capture_ms.set(now);
    }

    pub fn clear_ob_snapshots(&self) {
        self.ob_snapshots.set(Vec::new());
        self.ob_last_capture_ms.set(0.0);
    }

    pub fn get_ob_snapshots_in_range(&self, start: f64, end: f64) -> Vec<OrderBookSnapshot> {
        self.ob_snapshots.with(|snaps| {
            snaps
                .iter()
                .filter(|s| s.timestamp >= start && s.timestamp <= end)
                .cloned()
                .collect()
        })
    }

    // portfolioStore
    pub fn calculate_position_pnl(position: &PaperPosition, price: Option<f64>) -> f64 {
        let price = price.unwrap_or(position.current_price);
        let direction = if position.side == PaperSide::Long {
            1.0
        } else {
            -1.0
        };
        (price - position.entry_price) * position.quantity * direction
    }

    pub fn calculate_position_margin(entry_price: f64, quantity: f64, leverage: i64) -> f64 {
        (entry_price * quantity) / leverage as f64
    }

    /// Opens a paper position. Returns Err with the same messages as the TS store.
    pub fn open_position(
        &self,
        symbol: &str,
        side: PaperSide,
        quantity: f64,
        leverage: i64,
        entry_price: f64,
    ) -> Result<String, String> {
        if !quantity.is_finite() || quantity <= 0.0 {
            return Err("Quantity must be greater than zero".to_string());
        }
        if !entry_price.is_finite() || entry_price <= 0.0 {
            return Err("A live market price is required".to_string());
        }
        if leverage < 1 || leverage > 100 {
            return Err("Leverage must be an integer from 1 to 100".to_string());
        }

        let equity = self.starting_balance.get_untracked()
            + self.realized_pnl.get_untracked()
            + self.positions.with(|ps| {
                ps.iter()
                    .map(|p| Self::calculate_position_pnl(p, None))
                    .sum::<f64>()
            });
        let used_margin = self.positions.with(|ps| {
            ps.iter()
                .map(|p| Self::calculate_position_margin(p.entry_price, p.quantity, p.leverage))
                .sum::<f64>()
        });
        let required_margin = Self::calculate_position_margin(entry_price, quantity, leverage);
        if required_margin > (equity - used_margin).max(0.0) {
            return Err("Insufficient free paper margin".to_string());
        }

        let id = format!("paper_{}_{}", now_ms() as i64, random_suffix(6));
        let position = PaperPosition {
            id: id.clone(),
            symbol: symbol.to_string(),
            side,
            quantity,
            leverage,
            entry_price,
            current_price: entry_price,
            opened_at: now_ms(),
        };
        self.positions.update(|ps| ps.insert(0, position));
        Ok(id)
    }

    pub fn close_position(&self, id: &str, exit_price: f64) {
        if !exit_price.is_finite() || exit_price <= 0.0 {
            return;
        }
        let position = self
            .positions
            .with(|ps| ps.iter().find(|p| p.id == id).cloned());
        let Some(position) = position else { return };
        let pnl = Self::calculate_position_pnl(&position, Some(exit_price));
        let trade = PaperTrade {
            position: PaperPosition {
                current_price: exit_price,
                ..position.clone()
            },
            exit_price,
            closed_at: now_ms(),
            realized_pnl: pnl,
        };
        self.positions.update(|ps| ps.retain(|p| p.id != id));
        self.trades.update(|ts| {
            ts.insert(0, trade);
            ts.truncate(250);
        });
        self.realized_pnl.update(|p| *p += pnl);
    }

    pub fn update_price(&self, symbol: &str, price: f64) {
        if !price.is_finite() || price <= 0.0 {
            return;
        }
        self.positions.update(|ps| {
            for p in ps.iter_mut() {
                if p.symbol == symbol {
                    p.current_price = price;
                }
            }
        });
    }

    pub fn set_starting_balance(&self, balance: f64) {
        if balance.is_finite() && balance > 0.0 {
            self.starting_balance.set(balance);
        }
    }

    pub fn reset_portfolio(&self) {
        self.realized_pnl.set(0.0);
        self.positions.set(Vec::new());
        self.trades.set(Vec::new());
    }

    // alertStore
    pub fn add_alert(&self, alert: NewAlert) -> String {
        let id = format!("alert_{}_{}", now_ms() as i64, random_suffix(7));
        let entry = Alert {
            id: id.clone(),
            symbol: alert.symbol,
            alert_type: alert.alert_type,
            condition: alert.condition,
            value: alert.value,
            message: alert.message,
            enabled: alert.enabled,
            triggered: false,
            created_at: now_ms(),
            last_triggered: None,
            sound_enabled: alert.sound_enabled,
            notification_enabled: alert.notification_enabled,
            indicator: alert.indicator,
        };
        self.alerts.update(|list| list.push(entry));
        id
    }

    pub fn remove_alert(&self, id: &str) {
        self.alerts.update(|list| list.retain(|a| a.id != id));
        self.triggered_alerts.update(|t| t.retain(|t| t != id));
    }

    pub fn toggle_alert(&self, id: &str) {
        self.alerts.update(|list| {
            if let Some(a) = list.iter_mut().find(|a| a.id == id) {
                a.enabled = !a.enabled;
            }
        });
    }

    pub fn trigger_alert(&self, id: &str) {
        let now = now_ms();
        let entry = self.alerts.with(|list| {
            list.iter()
                .find(|a| a.id == id && a.enabled && !a.triggered)
                .cloned()
        });
        let Some(alert) = entry else { return };

        let history_entry = AlertHistoryEntry {
            alert: alert.clone(),
            triggered_at: now,
        };
        self.alerts.update(|list| {
            if let Some(a) = list.iter_mut().find(|a| a.id == id) {
                a.triggered = true;
                a.last_triggered = Some(now);
            }
        });
        self.triggered_alerts.update(|t| t.push(id.to_string()));
        self.alert_history.update(|h| h.push(history_entry));

        #[cfg(target_arch = "wasm32")]
        {
            if alert.notification_enabled {
                play_notification(&alert.symbol, &alert.message);
            }
            if alert.sound_enabled {
                play_alert_sound();
            }
        }
    }

    fn check_price_condition(price: f64, condition: AlertCondition, target: f64) -> bool {
        match condition {
            AlertCondition::Above => price > target,
            AlertCondition::Below => price < target,
            AlertCondition::Equals => (price - target).abs() < 0.01,
        }
    }

    /// Returns IDs of newly triggered alerts (mirrors `checkAlerts`).
    pub fn check_alerts(
        &self,
        symbol: &str,
        price: f64,
        market_data: Option<&MarketConditionData>,
    ) -> Vec<String> {
        let alerts_snapshot = self.alerts.get_untracked();
        let mut triggered = Vec::new();

        for alert in &alerts_snapshot {
            if !alert.enabled || alert.triggered || alert.symbol != symbol {
                continue;
            }
            let should_trigger = match alert.alert_type {
                AlertType::Price => match alert.value {
                    AlertValue::Num(v) => Self::check_price_condition(price, alert.condition, v),
                    _ => false,
                },
                AlertType::Indicator => {
                    let (Some(ind), Some(mdata), AlertValue::Num(v)) =
                        (alert.indicator, market_data, &alert.value)
                    else {
                        continue;
                    };
                    let indicator_value = match ind {
                        AlertIndicator::Rsi => mdata.rsi,
                        AlertIndicator::Macd => mdata.macd,
                        AlertIndicator::VolumeRatio => mdata.volume_ratio,
                        AlertIndicator::Ofi => mdata.ofi,
                        AlertIndicator::Liquidation => mdata.liquidation,
                    };
                    match indicator_value {
                        Some(iv) => Self::check_price_condition(iv, alert.condition, *v),
                        None => false,
                    }
                }
                AlertType::Volume => match (&alert.value, market_data.and_then(|m| m.volume_ratio))
                {
                    (AlertValue::Num(v), Some(ratio)) => {
                        Self::check_price_condition(ratio, alert.condition, *v)
                    }
                    _ => false,
                },

                AlertType::Signal => {
                    match (&alert.value, market_data.and_then(|m| m.signal.clone())) {
                        (AlertValue::Str(s), Some(sig)) => sig == *s,
                        _ => false,
                    }
                }
                AlertType::Ofi => match (&alert.value, market_data.and_then(|m| m.ofi)) {
                    (AlertValue::Num(v), Some(ofi)) => {
                        Self::check_price_condition(ofi, alert.condition, *v)
                    }
                    _ => false,
                },
                AlertType::Liquidation => {
                    match (&alert.value, market_data.and_then(|m| m.liquidation)) {
                        (AlertValue::Num(v), Some(liq)) => {
                            Self::check_price_condition(liq, alert.condition, *v)
                        }
                        _ => false,
                    }
                }
            };

            if should_trigger {
                self.trigger_alert(&alert.id);
                triggered.push(alert.id.clone());
            }
        }

        triggered
    }

    pub fn check_market_conditions(&self, symbol: &str, price: f64, data: MarketConditionData) {
        self.check_alerts(symbol, price, Some(&data));
    }

    pub fn get_alerts_by_symbol(&self, symbol: &str) -> Vec<Alert> {
        self.alerts.with(|list| {
            list.iter()
                .filter(|a| a.symbol == symbol)
                .cloned()
                .collect()
        })
    }

    pub fn get_active_alerts(&self) -> Vec<Alert> {
        self.alerts.with(|list| {
            list.iter()
                .filter(|a| a.enabled && !a.triggered)
                .cloned()
                .collect()
        })
    }

    pub fn clear_triggered_alerts(&self) {
        self.triggered_alerts.set(Vec::new());
    }

    pub fn clear_alerts(&self) {
        self.alerts.set(Vec::new());
        self.triggered_alerts.set(Vec::new());
    }

    pub fn clear_alert_history(&self) {
        self.alert_history.set(Vec::new());
    }
}

// ─── Browser notifications / alert sound ─────────────────────────────────────

#[cfg(target_arch = "wasm32")]
fn play_notification(title: &str, body: &str) {
    let options = web_sys::NotificationOptions::new();
    options.set_body(body);
    options.set_icon("/quant_term_logo.svg");
    let _ = web_sys::Notification::new_with_options(title, &options);
}

#[cfg(target_arch = "wasm32")]
fn play_alert_sound() {
    // Same embedded WAV as the TS AlertEngine.
    const SOUND_B64: &str = "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjJ7yvLRgj4IEnC67+yNRwsWZsfr77NSFQpJmu36vmQdBSp4y/HSlEILFGbA7/KUUA0KVbHj6MBkHgY5i9nxx2MqBCh0wfHZlj8JF3DF8+SOSwsYYrTq7aZNEQxGm9vvxGQhBi+D0fPTgjsHEWi/8eeJNQgZabvv6Zs+CRNlvez0mE0ODV2378NjHQY2jtH1zm0pBSZ2yo/LejgEEWrD8OOOSQsXX7nr87JiHgU6k9f0yXEqBSd4zvPWjj0IDmzB8O2NRQsVXrbn7qpSEQtGnOD1xWMcBjGH0fLOeygEJHXI89CGPwkVb7/y45FGDRVW6+n0sGAfBjiP1vLLeScEJnfM8tiLOwgTc8Xx4It4IQUqeMvw04k5BxNqv+3smEIKFGS97++VTw0OVrLl67JcGwU4jNPy0m8nBSV4y++8fzgGD2K87eJ7FgMW8BfD4/+3j60gcAIAAAEFCgsPEhUZHR8gISIiIiMiIiIhHx0YFhMPDAgHBQMCAAABAgQGCgsMCA0QFRUVFBQTExIRERAODgwMCgoDAwIBAAABAwQGBggKDAwODg8RERITExMUFBQUExMTEhIREA8PCgoJCAYFAwIBAAABAAIDBAQGBwgKDAwODg8RERITExMUFBQUExMTEhIREA8PCgoJCAYFAwIBAAACAwQGBgkLDQ4QERQVFhUWFRQUExERDw4MCwkIBQQCAgECAAAAAwMGBggJCwoMDA4PEBESExMSExMSERAPDgwLCggGBQMBAAABAAIDBAQGBwgKDAwN";
    if let Some(audio) = web_sys::HtmlAudioElement::new_with_src(SOUND_B64).ok() {
        let _ = audio.play();
    }
}
