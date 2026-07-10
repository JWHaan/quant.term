/**
 * Formatting utilities for market data display.
 * Pure functions — no side effects, fully testable.
 */

/**
 * Format a price value based on its magnitude.
 * - > 1000: 1 decimal place  (e.g. 65432.1)
 * - > 1:    3 decimal places (e.g. 3.456)
 * - <= 1:   6 decimal places (e.g. 0.000123)
 */
export function formatPrice(price: number): string {
    if (!price || isNaN(price)) return '—';
    if (price > 1_000) return price.toFixed(1);
    if (price > 1) return price.toFixed(3);
    return price.toFixed(6);
}

/**
 * Format a large volume number with B/M/K suffixes.
 */
export function formatVolume(num: number, decimals = 2): string {
    if (!num || isNaN(num)) return '—';
    if (num >= 1e9) return `${(num / 1e9).toFixed(decimals)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(decimals)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(decimals)}K`;
    return num.toFixed(decimals);
}

/**
 * Format a percentage change with a leading + for positive values.
 */
export function formatPercent(pct: number, decimals = 2): string {
    if (pct === null || pct === undefined || isNaN(pct)) return '—';
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${pct.toFixed(decimals)}%`;
}

/**
 * Format a UTC timestamp as HH:MM:SS.
 */
export function formatUTCTime(date: Date = new Date()): string {
    return date.toISOString().slice(11, 19);
}

/**
 * Format latency with quality label, or return '—' if not yet measured.
 */
export function formatLatency(latency: number | null, quality: string): string {
    if (latency === null || latency === 0) return '—';
    return `${latency}ms (${quality})`;
}
