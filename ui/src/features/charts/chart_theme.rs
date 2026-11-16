//! Port of `src/features/charts/chartTheme.ts` — resolves chart colors from
//! CSS custom properties with the same fallbacks as the TS `FALLBACK` table.

#[cfg(target_arch = "wasm32")]
fn css_var(name: &str) -> String {
    web_sys::window()
        .and_then(|w| {
            let el = w.document()?.document_element()?;
            w.get_computed_style(&el).ok().flatten()
        })
        .and_then(|style| style.get_property_value(name).ok())
        .map(|v| v.trim().to_string())
        .unwrap_or_default()
}

#[cfg(not(target_arch = "wasm32"))]
fn css_var(_name: &str) -> String {
    String::new()
}

fn pick(var_name: &str, fallback: &str) -> String {
    let value = css_var(var_name);
    if value.is_empty() {
        fallback.to_string()
    } else {
        value
    }
}

#[derive(Clone, Debug)]
pub struct ChartTheme {
    pub background: String,
    pub text_color: String,
    pub grid_color: String,
    pub border_color: String,
    pub up_color: String,
    pub down_color: String,
    pub crosshair_color: String,
    pub ema9: String,
    pub ema21: String,
    pub macd: String,
    pub signal: String,
    pub rsi: String,
}

impl Default for ChartTheme {
    fn default() -> Self {
        Self {
            background: "#0f172a".into(),
            text_color: "#94a3b8".into(),
            grid_color: "rgba(255, 255, 255, 0.05)".into(),
            border_color: "rgba(255, 255, 255, 0.1)".into(),
            up_color: "#22c55e".into(),
            down_color: "#ef4444".into(),
            crosshair_color: "rgba(255, 255, 255, 0.4)".into(),
            ema9: "#3b82f6".into(),
            ema21: "#8b5cf6".into(),
            macd: "#3b82f6".into(),
            signal: "#f59e0b".into(),
            rsi: "#a855f7".into(),
        }
    }
}

/// Resolve the theme from the document's CSS variables (or fallbacks).
/// Called on every chart redraw so theme flips are picked up on the next
/// data/size change (no MutationObserver in web-sys features).
pub fn resolve_chart_theme() -> ChartTheme {
    ChartTheme {
        background: pick("--chart-bg", "#0f172a"),
        text_color: pick("--text-secondary", "#94a3b8"),
        grid_color: pick("--chart-grid", "rgba(255, 255, 255, 0.05)"),
        border_color: pick("--chart-border", "rgba(255, 255, 255, 0.1)"),
        up_color: pick("--accent-success", "#22c55e"),
        down_color: pick("--accent-danger", "#ef4444"),
        crosshair_color: pick("--chart-crosshair", "rgba(255, 255, 255, 0.4)"),
        // Indicator colors are constants in the TS implementation.
        ema9: "#3b82f6".into(),
        ema21: "#8b5cf6".into(),
        macd: "#3b82f6".into(),
        signal: "#f59e0b".into(),
        rsi: "#a855f7".into(),
    }
}
