//! Command definitions — port of `src/features/command-palette/commands.ts`.

use std::sync::Arc;

/// A palette command. `action` runs when the command is executed.
#[derive(Clone)]
pub struct Command {
    pub id: &'static str,
    pub label: &'static str,
    pub description: &'static str,
    /// Text glyph standing in for the lucide icon (TODO: real icon set).
    pub icon: &'static str,
    pub action: Arc<dyn Fn() + Send + Sync>,
    pub category: &'static str,
    /// Bloomberg-style short code shown in the command line.
    pub mnemonic: Option<&'static str>,
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
    vec![
        Command {
            id: "open-monitor",
            label: "Open Market Monitor",
            description: "Switch to live market monitoring",
            icon: "▣",
            action: act(open_monitor),
            category: "Workspaces",
            mnemonic: Some("MON"),
        },
        Command {
            id: "open-strategy-lab",
            label: "Open Strategy Lab",
            description: "Configure and run a deterministic candle replay",
            icon: "◬",
            action: act(open_strategy_lab),
            category: "Workspaces",
            mnemonic: Some("LAB"),
        },
        Command {
            id: "focus-market",
            label: "Focus Market Watch",
            description: "Navigate to the market watch panel",
            icon: "◉",
            action: act(scroll_to_market),
            category: "Navigation",
            mnemonic: Some("MW"),
        },
        Command {
            id: "focus-chart",
            label: "Focus Chart",
            description: "Navigate to the main chart",
            icon: "▥",
            action: act(scroll_to_chart),
            category: "Navigation",
            mnemonic: Some("CHART"),
        },
        Command {
            id: "focus-alpha",
            label: "Focus Alpha Panel",
            description: "Navigate to alpha factors",
            icon: "▲",
            action: act(scroll_to_alpha),
            category: "Navigation",
            mnemonic: Some("ALPHA"),
        },
        Command {
            id: "focus-news",
            label: "Focus News",
            description: "Navigate to news feed",
            icon: "≡",
            action: act(scroll_to_news),
            category: "Navigation",
            mnemonic: Some("NEWS"),
        },
        Command {
            id: "toggle-help",
            label: "Show Keyboard Shortcuts",
            description: "View all available keyboard shortcuts",
            icon: "?",
            action: Arc::new(move || set_show_help(true)),
            category: "Help",
            mnemonic: Some("KEYS"),
        },
        Command {
            id: "analyze-btc",
            label: "Analyze BTCUSDT",
            description: "Switch symbol to Bitcoin",
            icon: "◉",
            action: {
                let set_symbol = Arc::clone(&set_symbol);
                Arc::new(move || set_symbol("BTCUSDT".to_string()))
            },
            category: "Actions",
            mnemonic: Some("TOP"),
        },
        Command {
            id: "analyze-eth",
            label: "Analyze ETHUSDT",
            description: "Switch symbol to Ethereum",
            icon: "◉",
            action: {
                let set_symbol = Arc::clone(&set_symbol);
                Arc::new(move || set_symbol("ETHUSDT".to_string()))
            },
            category: "Actions",
            mnemonic: Some("TOP"),
        },
        Command {
            id: "analyze-sol",
            label: "Analyze SOLUSDT",
            description: "Switch symbol to Solana",
            icon: "◉",
            action: {
                let set_symbol = Arc::clone(&set_symbol);
                Arc::new(move || set_symbol("SOLUSDT".to_string()))
            },
            category: "Actions",
            mnemonic: Some("TOP"),
        },
    ]
}
