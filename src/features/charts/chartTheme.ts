export interface ChartTheme {
    background: string;
    textColor: string;
    gridColor: string;
    borderColor: string;
    upColor: string;
    downColor: string;
    crosshairColor: string;
    ema9: string;
    ema21: string;
    macd: string;
    signal: string;
    rsi: string;
}

const FALLBACK = {
    background: '#0f172a',
    textColor: '#94a3b8',
    gridColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    upColor: '#22c55e',
    downColor: '#ef4444',
    crosshairColor: 'rgba(255, 255, 255, 0.4)',
    ema9: '#3b82f6',
    ema21: '#8b5cf6',
    macd: '#3b82f6',
    signal: '#f59e0b',
    rsi: '#a855f7',
} as const;

export const resolveChartTheme = (getVar: (name: string) => string): ChartTheme => ({
    background: getVar('--chart-bg').trim() || FALLBACK.background,
    textColor: getVar('--text-secondary').trim() || FALLBACK.textColor,
    // Grid, frame and crosshair are tokenised so the light theme does not paint
    // white-on-white hairlines over the chart canvas.
    gridColor: getVar('--chart-grid').trim() || FALLBACK.gridColor,
    borderColor: getVar('--chart-border').trim() || FALLBACK.borderColor,
    upColor: getVar('--accent-success').trim() || FALLBACK.upColor,
    downColor: getVar('--accent-danger').trim() || FALLBACK.downColor,
    crosshairColor: getVar('--chart-crosshair').trim() || FALLBACK.crosshairColor,
    ema9: FALLBACK.ema9,
    ema21: FALLBACK.ema21,
    macd: FALLBACK.macd,
    signal: FALLBACK.signal,
    rsi: FALLBACK.rsi,
});
