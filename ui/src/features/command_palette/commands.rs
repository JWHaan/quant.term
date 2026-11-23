//! Command definitions — port of `src/features/command-palette/commands.ts`.

use std::borrow::Cow;
use std::sync::Arc;

use crate::data::crypto_assets::TOP_CRYPTOS;

/// A palette command. `action` runs when the command is executed.
#[derive(Clone)]
pub struct Command {
    pub id: Cow<'static, str>,
    pub label: Cow<'static, str>,
    pub description: Cow<'static, str>,
    /// Text glyph standing in for the lucide icon (TODO: real icon set).
    pub icon: &'static str,
    pub action: Arc<dyn Fn() + Send + Sync>,
    pub category: &'static str,
    /// Bloomberg-style short code shown in the command line.
    pub mnemonic: Option<&'static str>,
    /// For `Analyze …` commands: the normalized spot symbol the action selects.
    /// Lets the palette resolve a free-text symbol query to the same command
    /// (and the same `set_symbol` dispatch) instead of re-implementing it.
    pub symbol: Option<&'static str>,
}

impl PartialEq for Command {
    fn eq(&self, other: &Self) -> bool {
        self.id == other.id
    }
}

/// Configuration callbacks — mirrors `CommandsConfig` in commands.ts.
pub struct CommandsConfig {
    pub set_show_help: Arc<dyn Fn(bool) + Send + Sync>,
    pub set_symbol: Arc<dyn Fn(String) + Send + Sync>,
    pub open_monitor: Arc<dyn Fn() + Send + Sync>,
    pub open_strategy_lab: Arc<dyn Fn() + Send + Sync>,
    pub scroll_to_market: Arc<dyn Fn() + Send + Sync>,
    pub scroll_to_chart: Arc<dyn Fn() + Send + Sync>,
    pub scroll_to_alpha: Arc<dyn Fn() + Send + Sync>,
    pub scroll_to_news: Arc<dyn Fn() + Send + Sync>,
}

/// `normalizeSymbolArg` — normalize free text like " btc " or "/sol"
/// into a tradable spot symbol, mirroring the TS regexes:
/// `^[A-Z0-9]{2,10}(USDT|USD)?$` applied after the USDT/USD suffix fix-up.
pub fn normalize_symbol_arg(raw: &str) -> Option<String> {
    let cleaned = raw.trim().trim_start_matches('/').to_uppercase();
    if cleaned.is_empty() {
        return None;
    }
    let candidate = if cleaned.ends_with("USDT") || cleaned.ends_with("USD") {
        cleaned
    } else {
        format!("{cleaned}USDT")
    };
    if is_valid_symbol(&candidate) {
        Some(candidate)
    } else {
        None
    }
}

fn is_valid_symbol(candidate: &str) -> bool {
    if candidate.is_empty()
        || !candidate
            .chars()
            .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit())
    {
        return false;
    }
    let len = candidate.len();
    // ^[A-Z0-9]{2,10}(USDT|USD)?$ — the optional suffix is ambiguous with the
    // base charset, so accept: 2..=10 bare chars, or 2..=10 chars + suffix.
    if (2..=10).contains(&len) {
        return true;
    }
    for suffix in ["USDT", "USD"] {
        if let Some(base) = candidate.strip_suffix(suffix) {
            if (2..=10).contains(&base.len()) {
                return true;
            }
        }
    }
    false
}

/// Look up the `Analyze` command bound to a normalized spot symbol (e.g.
/// `"BNBUSDT"`). Generated commands carry `symbol: Some(asset.symbol)` for
/// every `TOP_CRYPTOS` instrument, so this returns `None` for anything the
/// watchlist doesn't track — the palette's dynamic symbol results therefore
/// stay restricted to real instruments and dispatch through the exact same
/// `set_symbol` action as a static command row.
pub fn analyze_command_for<'a>(symbol: &str, commands: &'a [Command]) -> Option<&'a Command> {
    commands.iter().find(|c| c.symbol == Some(symbol))
}

/// Build the static command list — mirrors `buildCommands`.
pub fn build_commands(cfg: CommandsConfig) -> Vec<Command> {
    let CommandsConfig {
        set_show_help,
        set_symbol,
        open_monitor,
        open_strategy_lab,
        scroll_to_market,
        scroll_to_chart,
        scroll_to_alpha,
        scroll_to_news,
    } = cfg;

    let act = |f: Arc<dyn Fn() + Send + Sync>| f;
    let mut commands = vec![
        Command {
            id: "open-monitor".into(),
            label: "Open Market Monitor".into(),
            description: "Switch to live market monitoring".into(),
            icon: "▣",
            action: act(open_monitor),
            category: "Workspaces",
            mnemonic: Some("MON"),
            symbol: None,
        },
        Command {
            id: "open-strategy-lab".into(),
            label: "Open Strategy Lab".into(),
            description: "Configure and run a deterministic candle replay".into(),
            icon: "◬",
            action: act(open_strategy_lab),
            category: "Workspaces",
            mnemonic: Some("LAB"),
            symbol: None,
        },
        Command {
            id: "focus-market".into(),
            label: "Focus Market Watch".into(),
            description: "Navigate to the market watch panel".into(),
            icon: "◉",
            action: act(scroll_to_market),
            category: "Navigation",
            mnemonic: Some("MW"),
            symbol: None,
        },
        Command {
            id: "focus-chart".into(),
            label: "Focus Chart".into(),
            description: "Navigate to the main chart".into(),
            icon: "▥",
            action: act(scroll_to_chart),
            category: "Navigation",
            mnemonic: Some("CHART"),
            symbol: None,
        },
        Command {
            id: "focus-alpha".into(),
            label: "Focus Research Monitor".into(),
            description: "Navigate to the Research Monitor panel".into(),
            icon: "▲",
            action: act(scroll_to_alpha),
            category: "Navigation",
            mnemonic: Some("ALPHA"),
            symbol: None,
        },
        Command {
            id: "focus-news".into(),
            label: "Focus Market Intelligence".into(),
            description: "Navigate to the Market Intelligence panel".into(),
            icon: "≡",
            action: act(scroll_to_news),
            category: "Navigation",
            mnemonic: Some("NEWS"),
            symbol: None,
        },
        Command {
            id: "toggle-help".into(),
            label: "Show Keyboard Shortcuts".into(),
            description: "View all available keyboard shortcuts".into(),
            icon: "?",
            action: Arc::new(move || set_show_help(true)),
            category: "Help",
            mnemonic: Some("KEYS"),
            symbol: None,
        },
    ];

    // One Analyze command per Market Watch instrument (TOP_CRYPTOS) — the
    // palette surfaces these for symbol-like queries; all share the TOP
    // mnemonic and the same set_symbol dispatch.
    for asset in TOP_CRYPTOS {
        let symbol = asset.symbol;
        let set_symbol = Arc::clone(&set_symbol);
        commands.push(Command {
            id: format!("analyze-{}", symbol.to_lowercase()).into(),
            label: format!("Analyze {symbol}").into(),
            description: format!("Switch symbol to {}", asset.name).into(),
            icon: "◉",
            action: Arc::new(move || set_symbol(symbol.to_string())),
            category: "Actions",
            mnemonic: Some("TOP"),
            symbol: Some(symbol),
        });
    }

    commands
}
