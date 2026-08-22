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
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let disposed = false;
        let activeController: AbortController | null = null;

        const fetchData = async () => {
            activeController?.abort();
            const controller = new AbortController();
            activeController = controller;
            let timedOut = false;
            const timeout = window.setTimeout(() => {
                timedOut = true;
                controller.abort();
            }, 8_000);

            try {
                const res = await fetch(
                    `${BINANCE_REST_URL}/api/v3/klines?symbol=${encodeURIComponent(symbol.toUpperCase())}&interval=${encodeURIComponent(interval)}&limit=500`,
                    { signal: controller.signal },
                );
                if (!res.ok) throw new Error(`Binance returned ${res.status}`);
                const payload: unknown = await res.json();
                if (!Array.isArray(payload) || payload.length < 200) throw new Error('Insufficient kline history');
                const raw = payload as [number, string, string, string, string, string][];

                const result = computeAlphaFactors(raw.map(parseKlineRow));
                if (!disposed && !controller.signal.aborted && activeController === controller) {
                    setState({ ...result, loaded: true });
                    setError(null);
                }
            } catch (caught) {
                if (disposed || (controller.signal.aborted && !timedOut) || activeController !== controller) return;
                console.error('[AlphaPanel] Failed to fetch data:', caught);
                setError(timedOut ? 'Factor request timed out' : caught instanceof Error ? caught.message : 'Factor data unavailable');
            } finally {
                window.clearTimeout(timeout);
            }
        };

        fetchData();
        const id = setInterval(fetchData, MARKET_POLL_INTERVAL_MS);
        return () => {
            disposed = true;
            clearInterval(id);
            activeController?.abort();
        };
    }, [symbol, interval]);

    if (!state.loaded) {
        return (
            <div className="panel-loading">
                {error ? `[FACTOR_FEED_UNAVAILABLE] · ${error} · RETRYING` : <><Activity size={16} className="spin" style={{ marginRight: '8px' }} />[CALCULATING_ALPHA_FACTORS]…</>}
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
        <div className="panel-scroll panel-body">
            {error && (
                <div className="freshness-line panel-degraded">
                    DEGRADED · Latest factors retained · {error}
                </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                <div className="stat-card">
                    <div className="stat-card__label">MARKET_REGIME</div>
                    <div className="stat-card__value" style={{ color: getMarketConditionColor(state.marketCondition), display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {state.marketCondition === 'BULL' ? <TrendingUp size={14} /> : state.marketCondition === 'BEAR' ? <TrendingUp size={14} style={{ transform: 'scaleY(-1)' }} /> : state.marketCondition === 'VOLATILE' ? <Zap size={14} /> : <Activity size={14} />}
                        [{state.marketCondition}]
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-card__label">ALPHA_SCORE</div>
                    <div className="stat-card__value tnum" style={{ color: getScoreColor(state.scores.total) }}>
                        {state.scores.total > 0 ? '+' : ''}{state.scores.total.toFixed(0)}
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
                        <div className="tnum" style={{ color: 'var(--text-primary)' }}>{state.hurst.toFixed(3)}</div>
                        <div className="stat-card__sub">{state.regime}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-card__label">OBV_TREND</div>
                        <div style={{ color: state.obvTrend === 'BULLISH' ? 'var(--accent-success)' : state.obvTrend === 'BEARISH' ? 'var(--accent-danger)' : 'var(--text-muted)' }}>
                            [{state.obvTrend}]
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
