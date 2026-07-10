import React, { useEffect, useState } from 'react';
import { Activity, TrendingUp, Zap } from 'lucide-react';
import { OFIIndicator } from './OFIIndicator';
import { VolumeDeltaIndicator } from './VolumeDeltaIndicator';
import { VPINIndicator } from './VPINIndicator';
import {
    calculateHurst,
    calculateADX,
    calculateEMA,
    calculateRSI,
    calculateMACD,
    calculateATR,
    calculateBollingerBands,
    calculateOBV,
    calculateVWAP,
} from '@/utils/indicators';
import { BINANCE_REST_URL, MARKET_POLL_INTERVAL_MS, DEFAULT_SYMBOL } from '@/constants/config';

type CandlePoint = {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
};

interface AlphaPanelProps {
    symbol?: string;
    interval?: string;
}

interface AlphaState {
    loaded: boolean;
    regime: 'TRENDING' | 'MEAN_REVERSION' | 'RANDOM_WALK';
    marketCondition: 'BULL' | 'BEAR' | 'STATIC' | 'VOLATILE';
    hurst: number;
    adx: number;
    rsi: number;
    atrPercent: number;
    obvTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    scores: {
        trend: number;
        momentum: number;
        volatility: number;
        volume: number;
        total: number;
    };
}

const INITIAL_STATE: AlphaState = {
    loaded: false,
    regime: 'RANDOM_WALK',
    marketCondition: 'STATIC',
    hurst: 0.5,
    adx: 0,
    rsi: 50,
    atrPercent: 0,
    obvTrend: 'NEUTRAL',
    scores: { trend: 0, momentum: 0, volatility: 0, volume: 0, total: 0 },
};

const SCORE_COLORS = {
    positive: 'var(--accent-success)',
    negative: 'var(--accent-danger)',
    neutral: 'var(--text-muted)',
} as const;

function getScoreColor(score: number): string {
    if (score > 20) return SCORE_COLORS.positive;
    if (score < -20) return SCORE_COLORS.negative;
    return SCORE_COLORS.neutral;
}

function getMarketConditionColor(condition: AlphaState['marketCondition']): string {
    switch (condition) {
        case 'BULL':
            return 'var(--accent-success)';
        case 'BEAR':
            return 'var(--accent-danger)';
        case 'VOLATILE':
            return '#FFFF00';
        default:
            return 'var(--text-muted)';
    }
}

function parseKlineRow(d: [number, string, string, string, string, string]): CandlePoint {
    return {
        time: d[0] / 1000,
        open: parseFloat(d[1]),
        high: parseFloat(d[2]),
        low: parseFloat(d[3]),
        close: parseFloat(d[4]),
        volume: parseFloat(d[5]),
    };
}

function computeAlphaFactors(data: CandlePoint[]): Omit<AlphaState, 'loaded'> {
    const hurst = calculateHurst(data);
    let regime: AlphaState['regime'] = 'RANDOM_WALK';
    if (hurst > 0.55) regime = 'TRENDING';
    else if (hurst < 0.45) regime = 'MEAN_REVERSION';

    const adx = calculateADX(data, 14).at(-1)?.value ?? 0;

    const ema50 = calculateEMA(data, 50);
    const lastEMA = ema50.at(-1)?.value ?? 0;
    const prevEMA = ema50[Math.max(0, ema50.length - 11)]?.value ?? 0;
    const emaSlope = prevEMA !== 0 ? (lastEMA - prevEMA) / prevEMA : 0;

    let trendScore = 0;
    if (adx > 25) trendScore += 50;
    if (Math.abs(emaSlope) > 0.005) trendScore += 50 * Math.sign(emaSlope);

    const rsi = calculateRSI(data, 14).at(-1)?.value ?? 50;
    const macd = calculateMACD(data).at(-1);

    let momentumScore = 0;
    momentumScore += rsi > 50 ? 25 : -25;
    momentumScore += macd?.histogram && macd.histogram > 0 ? 25 : -25;

    const atr = calculateATR(data, 14).at(-1)?.value ?? 0;
    const lastClose = data.at(-1)?.close ?? 0;
    const atrPercent = lastClose !== 0 ? (atr / lastClose) * 100 : 0;

    const bb = calculateBollingerBands(data, 20, 2).at(-1);
    const bbWidth = bb && bb.middle !== 0 ? (bb.upper - bb.lower) / bb.middle : 0;

    let volatilityScore = 0;
    if (atrPercent > 1) volatilityScore += 50;
    if (bbWidth > 0.05) volatilityScore += 50;

    const obvData = calculateOBV(data);
    const obvLast = obvData.at(-1)?.value ?? 0;
    const obvPrev = obvData[Math.max(0, obvData.length - 21)]?.value ?? 0;
    const obvChange = obvLast - obvPrev;

    const vwap = calculateVWAP(data).at(-1)?.value ?? 0;
    const priceToVwap = vwap !== 0 ? (lastClose - vwap) / vwap : 0;

    let volumeScore = 0;
    volumeScore += obvChange > 0 ? 50 : -50;
    volumeScore += priceToVwap > 0 ? 25 : -25;

    const obvTrend: AlphaState['obvTrend'] = obvChange > 0 ? 'BULLISH' : obvChange < 0 ? 'BEARISH' : 'NEUTRAL';

    let marketCondition: AlphaState['marketCondition'] = 'STATIC';
    if (atrPercent > 1.5) marketCondition = 'VOLATILE';
    else if (lastClose > lastEMA && rsi > 55) marketCondition = 'BULL';
    else if (lastClose <= lastEMA && rsi < 45) marketCondition = 'BEAR';

    const totalScore = (trendScore * 0.4) + (momentumScore * 0.3) + (volumeScore * 0.3);

    return {
        regime,
        marketCondition,
        hurst,
        adx,
        rsi,
        atrPercent,
        obvTrend,
        scores: {
            trend: trendScore,
            momentum: momentumScore,
            volatility: volatilityScore,
            volume: volumeScore,
            total: Math.max(-100, Math.min(100, totalScore)),
        },
    };
}

const AlphaPanel: React.FC<AlphaPanelProps> = ({ symbol = DEFAULT_SYMBOL, interval = '15m' }) => {
    const [state, setState] = useState<AlphaState>(INITIAL_STATE);

    useEffect(() => {
        let cancelled = false;

        const fetchData = async () => {
            try {
                const res = await fetch(`${BINANCE_REST_URL}/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=500`);
                const raw = await res.json() as [number, string, string, string, string, string][];
                if (!Array.isArray(raw) || raw.length < 200) return;

                const result = computeAlphaFactors(raw.map(parseKlineRow));
                if (!cancelled) setState({ ...result, loaded: true });
            } catch (error) {
                console.error('[AlphaPanel] Failed to fetch data:', error);
            }
        };

        fetchData();
        const id = setInterval(fetchData, MARKET_POLL_INTERVAL_MS);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, [symbol, interval]);

    if (!state.loaded) {
        return (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                <Activity size={16} className="spin" style={{ marginRight: '8px' }} />
                [CALCULATING_ALPHA_FACTORS]...
            </div>
        );
    }

    const factorRows = [
        { label: 'TREND', score: state.scores.trend, value: `${state.adx.toFixed(1)} ADX` },
        { label: 'MOMENTUM', score: state.scores.momentum, value: `${state.rsi.toFixed(1)} RSI` },
        { label: 'VOLATILITY', score: state.scores.volatility, value: `${state.atrPercent.toFixed(2)}% ATR` },
        { label: 'VOLUME', score: state.scores.volume, value: state.obvTrend },
    ];

    return (
        <div style={{ padding: '12px', height: '100%', overflowY: 'auto', background: 'var(--bg-panel)', fontFamily: 'var(--font-mono)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                <div style={{ background: 'rgba(51, 255, 0, 0.05)', padding: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>MARKET_REGIME</div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: getMarketConditionColor(state.marketCondition), display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {state.marketCondition === 'BULL' ? <TrendingUp size={14} /> : state.marketCondition === 'BEAR' ? <TrendingUp size={14} style={{ transform: 'scaleY(-1)' }} /> : state.marketCondition === 'VOLATILE' ? <Zap size={14} /> : <Activity size={14} />}
                        [{state.marketCondition}]
                    </div>
                </div>

                <div style={{ background: 'rgba(51, 255, 0, 0.05)', padding: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>ALPHA_SCORE</div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: getScoreColor(state.scores.total) }}>
                        {state.scores.total > 0 ? '+' : ''}{state.scores.total.toFixed(0)}
                    </div>
                </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '2px' }}>
                    &gt; FACTOR_ANALYSIS
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {factorRows.map((factor) => (
                        <div key={factor.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', padding: '4px 8px', background: '#000', borderLeft: `2px solid ${getScoreColor(factor.score)}` }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{factor.label}</span>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{factor.value}</span>
                                <span style={{ color: getScoreColor(factor.score), fontWeight: 'bold', width: '30px', textAlign: 'right' }}>
                                    {factor.score > 0 ? '+' : ''}{factor.score}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '2px' }}>
                    &gt; DEEP_DIVE
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px' }}>
                    <div style={{ padding: '6px', background: '#000', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>HURST_EXP</div>
                        <div style={{ color: 'var(--text-primary)' }}>{state.hurst.toFixed(3)}</div>
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{state.regime}</div>
                    </div>
                    <div style={{ padding: '6px', background: '#000', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>OBV_TREND</div>
                        <div style={{ color: state.obvTrend === 'BULLISH' ? 'var(--accent-success)' : state.obvTrend === 'BEARISH' ? 'var(--accent-danger)' : 'var(--text-muted)' }}>
                            [{state.obvTrend}]
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '2px' }}>
                    &gt; ORDER_FLOW_IMBALANCE
                </div>
                <OFIIndicator symbol={symbol} />
            </div>

            <div style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '2px' }}>
                    &gt; VOL_DELTA_CVD
                </div>
                <VolumeDeltaIndicator symbol={symbol} />
            </div>

            <div style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '2px' }}>
                    &gt; VPIN_TOXICITY
                </div>
                <VPINIndicator symbol={symbol} />
            </div>
        </div>
    );
};

export default AlphaPanel;
