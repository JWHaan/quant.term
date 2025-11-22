import React, { useEffect, useState } from 'react';
import { calculateEMA } from '@/utils/indicators';

const BINANCE_REST_URL = 'https://api.binance.com';

// Simple helper to compute log returns
const computeReturns = (data) => {
    const rets = [];
    for (let i = 1; i < data.length; i++) {
        const prev = data[i - 1].close;
        const curr = data[i].close;
        if (prev > 0) {
            rets.push(Math.log(curr / prev));
        }
    }
    return rets;
};

const std = (xs) => {
    if (xs.length === 0) return 0;
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const v = xs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / xs.length;
    return Math.sqrt(v);
};

const normalizeScore = (value, lo, hi) => {
    if (hi === lo) return 0;
    const x = (value - lo) / (hi - lo);
    return Math.max(-100, Math.min(100, (x - 0.5) * 200));
};

const AlphaPanel = ({ symbol = 'BTCUSDT', interval = '15m' }) => {
    const [alpha, setAlpha] = useState({
        trend: 0,
        momentum: 0,
        volatility: 0,
        sharpe: 0,
        loaded: false,
    });

    const [series, setSeries] = useState({
        closes: [],
        ema20: [],
        vol: [],
        drawdown: [],
    });

    useEffect(() => {
        let cancelled = false;

        const fetchData = async () => {
            try {
                const sym = symbol.toUpperCase();
                const res = await fetch(
                    `${BINANCE_REST_URL}/api/v3/klines?symbol=${sym}&interval=${interval}&limit=200`,
                );
                const raw = await res.json();
                if (!Array.isArray(raw) || raw.length < 50) return;

                const data = raw.map((d) => ({
                    time: d[0] / 1000,
                    open: parseFloat(d[1]),
                    high: parseFloat(d[2]),
                    low: parseFloat(d[3]),
                    close: parseFloat(d[4]),
                    volume: parseFloat(d[5]),
                }));

                const closes = data.map((d) => d.close);
                const rets = computeReturns(data);

                const vol = std(rets) * Math.sqrt(96); // approx daily from 15m

                // Momentum: price change over last 20 bars
                const last = closes[closes.length - 1];
                const prev20 = closes[closes.length - 21];
                const mom = (last - prev20) / prev20;

                // Trend: EMA(20) slope over last 10 points
                const ema20Points = calculateEMA(data, 20).map((p) => p.value);
                const n = ema20Points.length;
                let slope = 0;
                if (n > 10) {
                    const a = ema20Points[n - 11];
                    const b = ema20Points[n - 1];
                    slope = (b - a) / a;
                }

                const meanRet = rets.reduce((a, b) => a + b, 0) / rets.length;
                const volRet = std(rets);
                const sharpe = volRet > 0 ? (meanRet / volRet) * Math.sqrt(96) : 0;

                // Rolling volatility series (for charting)
                const windowSize = 20;
                const volSeries = [];
                for (let i = windowSize; i <= rets.length; i++) {
                    const slice = rets.slice(i - windowSize, i);
                    volSeries.push(std(slice));
                }

                // Drawdown series based on running max of closes
                const ddSeries = [];
                let runMax = closes[0];
                for (let i = 0; i < closes.length; i++) {
                    runMax = Math.max(runMax, closes[i]);
                    const dd = (closes[i] - runMax) / runMax; // negative drawdown
                    ddSeries.push(dd);
                }

                const trendScore = normalizeScore(slope, -0.02, 0.02);
                const momScore = normalizeScore(mom, -0.05, 0.05);
                const volScore = normalizeScore(vol, 0, 1);
                const sharpeScore = normalizeScore(sharpe, -1, 1);

                if (!cancelled) {
                    setAlpha({
                        trend: trendScore,
                        momentum: momScore,
                        volatility: volScore,
                        sharpe: sharpeScore,
                        loaded: true,
                    });
                    setSeries({ closes, ema20: ema20Points, vol: volSeries, drawdown: ddSeries });
                }
            } catch (error) {
                console.error('[AlphaPanel] Failed to fetch data:', error);
                if (!cancelled) {
                    setAlpha((prev) => ({ ...prev, loaded: false }));
                }
            }
        };

        fetchData();
        const id = setInterval(fetchData, 15000);

        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, [symbol, interval]);

    const renderBar = (label, value, positiveLabel, negativeLabel, colorPos, colorNeg) => {
        const width = Math.min(100, Math.abs(value));
        const isPos = value >= 0;
        const bg = isPos ? colorPos : colorNeg;
        const text = isPos ? positiveLabel : negativeLabel;

        return (
            <div style={{ marginBottom: 6 }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 10,
                    color: 'var(--text-muted)',
                    marginBottom: 2,
                }}>
                    <span>{label}</span>
                    <span>{value.toFixed(0)}</span>
                </div>
                <div style={{
                    position: 'relative',
                    width: '100%',
                    height: 8,
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: 4,
                    overflow: 'hidden',
                }}>
                    <div
                        style={{
                            position: 'absolute',
                            left: value >= 0 ? '50%' : `${50 - width / 2}%`,
                            width: `${width / 2}%`,
                            height: '100%',
                            background: bg,
                        }}
                    />
                    <div
                        style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 9,
                            color: 'var(--text-secondary)',
                        }}
                    >
                        {text}
                    </div>
                </div>
            </div>
        );
    };

    // Build simple SVG sparkline for closes + EMA20
    const renderPriceSparkline = () => {
        if (!series.closes.length || !series.ema20.length) return null;

        const w = 200;
        const h = 60;
        const lastN = 80;
        const closes = series.closes.slice(-lastN);
        const ema = series.ema20.slice(-lastN);
        const min = Math.min(...closes, ...ema);
        const max = Math.max(...closes, ...ema);
        if (min === max) return null;

        const scaleX = (i) => (i / (closes.length - 1)) * w;
        const scaleY = (v) => h - ((v - min) / (max - min)) * h;

        const linePath = (arr) =>
            arr
                .map((v, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i).toFixed(1)} ${scaleY(v).toFixed(1)}`)
                .join(' ');

        return (
            <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
                <path d={linePath(closes)} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
                <path d={linePath(ema)} fill="none" stroke="rgba(0,255,157,0.8)" strokeWidth="1" />
            </svg>
        );
    };

    // Volatility sparkline based on rolling std of returns
    const renderVolSparkline = () => {
        if (!series.vol.length) return null;

        const w = 200;
        const h = 40;
        const lastN = 80;
        const vols = series.vol.slice(-lastN);
        const min = Math.min(...vols);
        const max = Math.max(...vols);
        if (min === max) return null;

        const scaleX = (i) => (i / (vols.length - 1)) * w;
        const scaleY = (v) => h - ((v - min) / (max - min)) * h;

        const path = vols
            .map((v, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i).toFixed(1)} ${scaleY(v).toFixed(1)}`)
            .join(' ');

        return (
            <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
                <path d={path} fill="none" stroke="rgba(255,184,77,0.9)" strokeWidth="1" />
            </svg>
        );
    };

    // Drawdown sparkline (negative values, larger magnitude = deeper drawdown)
    const renderDrawdownSparkline = () => {
        if (!series.drawdown.length) return null;

        const w = 200;
        const h = 40;
        const lastN = 80;
        const dds = series.drawdown.slice(-lastN);
        const min = Math.min(...dds); // most negative
        const max = 0; // capped at 0
        if (min === max) return null;

        const scaleX = (i) => (i / (dds.length - 1)) * w;
        const scaleY = (v) => h - ((v - min) / (max - min)) * h;

        const path = dds
            .map((v, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i).toFixed(1)} ${scaleY(v).toFixed(1)}`)
            .join(' ');

        return (
            <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
                <path d={path} fill="none" stroke="rgba(255,59,48,0.9)" strokeWidth="1" />
            </svg>
        );
    };

    return (
        <div
            style={{
                height: '100%',
                padding: '10px',
                background: 'rgba(0,0,0,0.7)',
                borderLeft: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                fontFamily: 'var(--font-ui)',
                color: 'var(--text-primary)',
            }}
        >
            <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Alpha Factors
                </div>
                <div
                    style={{
                        fontSize: 13,
                        fontFamily: 'var(--font-mono)',
                        marginTop: 2,
                    }}
                >
                    {symbol.toUpperCase()} @ {interval.toUpperCase()}
                </div>
            </div>

            {!alpha.loaded && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Loading factors...</div>
            )}

            {alpha.loaded && (
                <>
                    <div style={{ marginBottom: 6 }}>{renderPriceSparkline()}</div>
                    <div style={{ marginBottom: 8, fontSize: 9, color: 'var(--text-muted)' }}>Price & EMA(20)</div>
                    <div style={{ marginBottom: 4 }}>{renderVolSparkline()}</div>
                    <div style={{ marginBottom: 8, fontSize: 9, color: 'var(--text-muted)' }}>Rolling Volatility</div>
                    <div style={{ marginBottom: 4 }}>{renderDrawdownSparkline()}</div>
                    <div style={{ marginBottom: 10, fontSize: 9, color: 'var(--text-muted)' }}>Drawdown</div>
                    {renderBar('Trend', alpha.trend, 'Uptrend', 'Downtrend', 'rgba(0,255,157,0.6)', 'rgba(255,59,48,0.6)')}
                    {renderBar('Momentum', alpha.momentum, 'Positive', 'Negative', 'rgba(0,255,157,0.4)', 'rgba(255,59,48,0.4)')}
                    {renderBar('Volatility', alpha.volatility, 'High Vol', 'Low Vol', 'rgba(255,184,77,0.6)', 'rgba(120,120,120,0.6)')}
                    {renderBar('Sharpe-like', alpha.sharpe, 'Favourable', 'Unfavourable', 'rgba(0,255,157,0.5)', 'rgba(255,59,48,0.5)')}
                </>
            )}
        </div>
    );
};

export default AlphaPanel;
