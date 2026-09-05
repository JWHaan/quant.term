import React, { useMemo } from 'react';
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
import { useKlineSnapshot } from '@/hooks/useKlineSnapshot';
import { MARKET_POLL_INTERVAL_MS, DEFAULT_SYMBOL } from '@/constants/config';
import type { OHLCV } from '@/types/common';

interface AlphaPanelProps {
    symbol?: string;
    interval?: string;
}

interface AlphaFactors {
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

const MIN_CANDLES_FOR_FACTORS = 200;
const HISTORY_LIMIT = 500;

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

function getMarketConditionColor(condition: AlphaFactors['marketCondition']): string {
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

function computeAlphaFactors(data: OHLCV[]): AlphaFactors | null {
    if (data.length < MIN_CANDLES_FOR_FACTORS) return null;

    const hurst = calculateHurst(data);
    let regime: AlphaFactors['regime'] = 'RANDOM_WALK';
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

    const obvTrend: AlphaFactors['obvTrend'] = obvChange > 0 ? 'BULLISH' : obvChange < 0 ? 'BEARISH' : 'NEUTRAL';

    let marketCondition: AlphaFactors['marketCondition'] = 'STATIC';
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
    const { candles, isLoading, error } = useKlineSnapshot(
        symbol,
        interval,
        HISTORY_LIMIT,
        { pollMs: MARKET_POLL_INTERVAL_MS, label: 'Factor' },
    );

    const factors = useMemo(() => computeAlphaFactors(candles), [candles]);

    if (!factors) {
        const unavailable = error ?? (isLoading ? null : 'Insufficient kline history');
        return (
            <div className="panel-loading">
                {unavailable
                    ? `[FACTOR_FEED_UNAVAILABLE] · ${unavailable} · RETRYING`
                    : <><Activity size={16} className="spin" style={{ marginRight: '8px' }} />[CALCULATING_ALPHA_FACTORS]…</>}
            </div>
        );
    }

    const { regime, marketCondition, hurst, adx, rsi, atrPercent, obvTrend, scores } = factors;

    const factorRows = [
        { label: 'TREND', score: scores.trend, value: `${adx.toFixed(1)} ADX` },
        { label: 'MOMENTUM', score: scores.momentum, value: `${rsi.toFixed(1)} RSI` },
        { label: 'VOLATILITY', score: scores.volatility, value: `${atrPercent.toFixed(2)}% ATR` },
        { label: 'VOLUME', score: scores.volume, value: obvTrend },
    ];

    return (
        <div className="panel-scroll panel-body">
            {error && (
                <div className="freshness-line panel-degraded">
                    DEGRADED · Latest factors retained · {error}
                </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                <div className="stat-card">
                    <div className="stat-card__label">MARKET_REGIME</div>
                    <div className="stat-card__value" style={{ color: getMarketConditionColor(marketCondition), display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {marketCondition === 'BULL' ? <TrendingUp size={14} /> : marketCondition === 'BEAR' ? <TrendingUp size={14} style={{ transform: 'scaleY(-1)' }} /> : marketCondition === 'VOLATILE' ? <Zap size={14} /> : <Activity size={14} />}
                        [{marketCondition}]
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-card__label">ALPHA_SCORE</div>
                    <div className="stat-card__value tnum" style={{ color: getScoreColor(scores.total) }}>
                        {scores.total > 0 ? '+' : ''}{scores.total.toFixed(0)}
                    </div>
                </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
                <div className="panel-section-title">
                    &gt; FACTOR_ANALYSIS
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {factorRows.map((factor) => (
                        <div key={factor.label} className="factor-row" style={{ borderLeft: `2px solid ${getScoreColor(factor.score)}` }}>
                            <span className="factor-row__label">{factor.label}</span>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <span className="factor-row__meta tnum">{factor.value}</span>
                                <span className="factor-row__score tnum" style={{ color: getScoreColor(factor.score) }}>
                                    {factor.score > 0 ? '+' : ''}{factor.score}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <div className="panel-section-title">
                    &gt; DEEP_DIVE
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px' }}>
                    <div className="stat-card">
                        <div className="stat-card__label">HURST_EXP</div>
                        <div className="tnum" style={{ color: 'var(--text-primary)' }}>{hurst.toFixed(3)}</div>
                        <div className="stat-card__sub">{regime}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-card__label">OBV_TREND</div>
                        <div style={{ color: obvTrend === 'BULLISH' ? 'var(--accent-success)' : obvTrend === 'BEARISH' ? 'var(--accent-danger)' : 'var(--text-muted)' }}>
                            [{obvTrend}]
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '16px' }}>
                <div className="panel-section-title">
                    &gt; ORDER_FLOW_IMBALANCE
                </div>
                <OFIIndicator symbol={symbol} />
            </div>

            <div style={{ marginTop: '16px' }}>
                <div className="panel-section-title">
                    &gt; VOL_DELTA_CVD
                </div>
                <VolumeDeltaIndicator symbol={symbol} />
            </div>

            <div style={{ marginTop: '16px' }}>
                <div className="panel-section-title">
                    &gt; VPIN_TOXICITY
                </div>
                <VPINIndicator symbol={symbol} />
            </div>
        </div>
    );
};

export default AlphaPanel;
