//! Formatting helpers — port of the pieces of `src/utils/format.ts` used by
//! the Strategy Lab and equity curve.

use quant_core::typed;

/// Port of `formatPrice` in src/utils/format.ts.
pub fn format_price(price: f64) -> String {
    if price == 0.0 || !price.is_finite() {
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

/// Port of `formatCurrency` in src/utils/format.ts.
pub fn format_currency(num: f64, decimals: usize) -> String {
    if !num.is_finite() {
        return "—".to_string();
    }
    let absolute = num.abs();
    let formatted = if absolute >= 1e9 {
        format_compact(absolute / 1e9, decimals, 'B')
    } else if absolute >= 1e6 {
        format_compact(absolute / 1e6, decimals, 'M')
    } else if absolute >= 1e3 {
        format_compact(absolute / 1e3, decimals, 'K')
    } else {
        format!("{:.*}", decimals, absolute)
    };
    format!("{}{}", if num < 0.0 { "-$" } else { "$" }, formatted)
}

fn format_compact(value: f64, decimals: usize, suffix: char) -> String {
    let factor = 10f64.powi(decimals as i32);
    let rounded = (value * factor).round() / factor;
    let mut s = format!("{:.*}", decimals, rounded);
    s.push(suffix);
    s
}

/// Signed percent used across the backtest metrics: "+1.23%" / "-4.56%".
pub fn signed_percent(value: f64) -> String {
    format!("{}{}%", if value >= 0.0 { "+" } else { "" }, fmt_fixed(value, 2))
}

fn fmt_fixed(value: f64, decimals: usize) -> String {
    format!("{:.*}", decimals, value)
}

/// `new Date(time * 1000).toISOString().replace('T',' ').slice(0,16)`.
pub fn format_timestamp(unix_seconds: f64) -> String {
    typed::format_utc_minute(unix_seconds)
}

/// Gap report chip text from StrategyLab.
pub fn describe_gap_report(report: &typed::GapReport) -> String {
    if report.gap_count > 0 {
        format!(
            "GAPS {} · MISSING {} bars",
            report.gap_count, report.missing_bars
        )
    } else {
        "NO GAPS DETECTED".to_string()
    }
}

/// Plain number rendering for form fields / messages (JS `${n}` style:
/// integral floats print without a decimal point, NaN renders empty).
pub fn fmt_num(value: f64) -> String {
    if value.is_nan() {
        String::new()
    } else if value.fract() == 0.0 && value.abs() < 9.0e15 {
        format!("{}", value as i64)
    } else {
        format!("{value}")
    }
}

/// Last `n` hex chars of a checksum, matching `checksum.slice(-8)`.
pub fn checksum_tail(checksum: &str) -> &str {
    let n = checksum.len();
    &checksum[n.saturating_sub(8)..]
}
