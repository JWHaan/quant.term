import React, { useEffect, useState } from 'react';
import { TrendingUp, Activity, Zap } from 'lucide-react';
import { OFIIndicator } from './OFIIndicator';
import { VolumeDeltaIndicator } from './VolumeDeltaIndicator';
import { VPINIndicator } from './VPINIndicator';
import {
    calculateHurst, calculateADX, calculateEMA, calculateRSI,
    calculateMACD, calculateATR, calculateBollingerBands,
    calculateOBV, calculateVWAP
} from '@/utils/indicators';

const BINANCE_REST_URL = 'https://api.binance.com';

// Inline computation — replaces deprecated alphaWorker
function computeAlphaFactors(data: any[], _symbol: string) {
    const hurst = calculateHurst(data);
    let regime: AlphaState['regime'] = 'RANDOM_WALK';
    if (hurst > 0.55) regime = 'TRENDING';
    else if (hurst < 0.45) regime = 'MEAN_REVERSION';

    const adxData = calculateADX(data, 14);
    const adx = adxData[adxData.length - 1]?.value || 0;

    const ema50 = calculateEMA(data, 50);
    const lastEMA = ema50[ema50.length - 1]?.value || 0;
    const prevEMA = ema50[Math.max(0, ema50.length - 11)]?.value || 0;
    const emaSlope = prevEMA !== 0 ? (lastEMA - prevEMA) / prevEMA : 0;

    let trendScore = 0;
    if (adx > 25) trendScore += 50;
    if (Math.abs(emaSlope) > 0.005) trendScore += 50 * Math.sign(emaSlope);

    const rsiData = calculateRSI(data, 14);
    const rsi = rsiData[rsiData.length - 1]?.value || 50;

    const macdData = calculateMACD(data);
    const macd = macdData[macdData.length - 1];

    let momScore = 0;
    if (rsi > 50) momScore += 25; else momScore -= 25;
    if (macd && macd.histogram > 0) momScore += 25; else momScore -= 25;

    const atrData = calculateATR(data, 14);
    const atr = atrData[atrData.length - 1]?.value || 0;
    const lastClose = data[data.length - 1].close;
    const atrPercent = lastClose !== 0 ? (atr / lastClose) * 100 : 0;

    const bbData = calculateBollingerBands(data, 20, 2);
    const bb = bbData[bbData.length - 1];
    const bbWidth = bb && bb.middle !== 0 ? (bb.upper - bb.lower) / bb.middle : 0;

    let volScore = 0;
    if (atrPercent > 1) volScore += 50;
    if (bbWidth > 0.05) volScore += 50;

    const obvData = calculateOBV(data);
    const obvLast = obvData[obvData.length - 1]?.value || 0;
    const obvPrev = obvData[Math.max(0, obvData.length - 21)]?.value || 0;
    const obvChange = obvLast - obvPrev;

    const vwapData = calculateVWAP(data);
    const vwap = vwapData[vwapData.length - 1]?.value || 0;
    const priceToVwap = vwap !== 0 ? (lastClose - vwap) / vwap : 0;

    let volmScore = 0;
    if (obvChange > 0) volmScore += 50; else volmScore -= 50;
    if (priceToVwap > 0) volmScore += 25; else volmScore -= 25;

    const obvTrend = obvChange > 0 ? 'BULLISH' as const : obvChange < 0 ? 'BEARISH' as const : 'NEUTRAL' as const;

    let marketCondition: AlphaState['marketCondition'] = 'STATIC';
    const isAboveSMA = lastClose > lastEMA;
    if (atrPercent > 1.5) {
        marketCondition = 'VOLATILE';
    } else if (isAboveSMA && rsi > 55) {
        marketCondition = 'BULL';
    } else if (!isAboveSMA && rsi < 45) {
        marketCondition = 'BEAR';
    }

    const totalScore = (trendScore * 0.4) + (momScore * 0.3) + (volmScore * 0.3);

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
            momentum: momScore,
            volatility: volScore,
            volume: volmScore,
            total: Math.max(-100, Math.min(100, totalScore))
        }
    };
}

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

const AlphaPanel: React.FC<AlphaPanelProps> = ({ symbol = 'BTCUSDT', interval = '15m' }) => {
    const [state, setState] = useState<AlphaState>({
        loaded: false,
        regime: 'RANDOM_WALK',
        marketCondition: 'STATIC',
        hurst: 0.5,
        adx: 0,
        rsi: 50,
        atrPercent: 0,
        obvTrend: 'NEUTRAL',
        scores: { trend: 0, momentum: 0, volatility: 0, volume: 0, total: 0 }
    });
    useEffect(() => {
        let cancelled = false;

        const fetchData = async () => {
            if (cancelled) return;
            try {
                const res = await fetch(
                    `${BINANCE_REST_URL}/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=500`
                );
                const raw = await res.json();
                if (!Array.isArray(raw) || raw.length < 200) return;

                const data = raw.map((d: any) => ({
                    time: d[0] / 1000,
                    open: parseFloat(d[1]),
                    high: parseFloat(d[2]),
                    low: parseFloat(d[3]),
                    close: parseFloat(d[4]),
                    volume: parseFloat(d[5]),
                }));

                // Compute indicators inline (worker removed — see alphaWorker deprecation)
                const result = computeAlphaFactors(data, symbol);
                if (!cancelled) {
                    setState(prev => ({ ...prev, ...result, loaded: true }));
                }
            } catch (error) {
                console.error('[AlphaPanel] Failed to fetch data:', error);
            }
        };

        fetchData();
        const id = setInterval(fetchData, 15000);

        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, [symbol, interval]);

    if (!state.loaded) {
        return (
            <div style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)'
            }}>
                <Activity size={16} className="spin" style={{ marginRight: '8px' }} />
                [CALCULATING_ALPHA_FACTORS]...
            </div>
        );
    }

    const getScoreColor = (score: number) => {
        if (score > 20) return 'var(--accent-success)';
        if (score < -20) return 'var(--accent-danger)';
        return 'var(--text-muted)';
    };

    const getRegimeColor = (regime: string) => {
        switch (regime) {
            case 'BULL': return 'var(--accent-success)';
            case 'BEAR': return 'var(--accent-danger)';
            case 'VOLATILE': return '#FFFF00'; // Yellow
            default: return 'var(--text-muted)';
        }
    };

    return (
        <div style={{ padding: '12px', height: '100%', overflowY: 'auto', background: 'var(--bg-panel)', fontFamily: 'var(--font-mono)' }}>
            {/* Top Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                <div style={{
                    background: 'rgba(51, 255, 0, 0.05)',
                    padding: '8px',
                    border: '1px solid var(--border-color)'
                }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>MARKET_REGIME</div>
                    <div style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: getRegimeColor(state.marketCondition),
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}>
                        {state.marketCondition === 'BULL' ? <TrendingUp size={14} /> :
                            state.marketCondition === 'BEAR' ? <TrendingUp size={14} style={{ transform: 'scaleY(-1)' }} /> :
                                state.marketCondition === 'VOLATILE' ? <Zap size={14} /> :
                                    <Activity size={14} />}
                        [{state.marketCondition}]
                    </div>
                </div>

                <div style={{
                    background: 'rgba(51, 255, 0, 0.05)',
                    padding: '8px',
                    border: '1px solid var(--border-color)'
                }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>ALPHA_SCORE</div>
                    <div style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: getScoreColor(state.scores.total)
                    }}>
                        {state.scores.total > 0 ? '+' : ''}{state.scores.total.toFixed(0)}
                    </div>
                </div>
            </div>

            {/* Factor Breakdown */}
            <div style={{ marginBottom: '16px' }}>
                <div style={{
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    marginBottom: '8px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    borderBottom: '1px solid var(--border-subtle)',
                    paddingBottom: '2px'
                }}>
                    &gt; FACTOR_ANALYSIS
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {[
                        { label: 'TREND', score: state.scores.trend, val: state.adx.toFixed(1) + ' ADX' },
                        { label: 'MOMENTUM', score: state.scores.momentum, val: state.rsi.toFixed(1) + ' RSI' },
                        { label: 'VOLATILITY', score: state.scores.volatility, val: state.atrPercent.toFixed(2) + '% ATR' },
                        { label: 'VOLUME', score: state.scores.volume, val: state.obvTrend }
                    ].map((factor) => (
                        <div key={factor.label} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '11px',
                            padding: '4px 8px',
                            background: '#000',
                            borderLeft: `2px solid ${getScoreColor(factor.score)}`
                        }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{factor.label}</span>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{factor.val}</span>
                                <span style={{
                                    color: getScoreColor(factor.score),
                                    fontWeight: 'bold',
                                    width: '30px',
                                    textAlign: 'right'
                                }}>
                                    {factor.score > 0 ? '+' : ''}{factor.score}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Technicals */}
            <div>
                <div style={{
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    marginBottom: '8px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    borderBottom: '1px solid var(--border-subtle)',
                    paddingBottom: '2px'
                }}>
                    &gt; DEEP_DIVE
                </div>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                    fontSize: '11px'
                }}>
                    <div style={{ padding: '6px', background: '#000', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>HURST_EXP</div>
                        <div style={{ color: 'var(--text-primary)' }}>{state.hurst.toFixed(3)}</div>
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{state.regime}</div>
                    </div>
                    <div style={{ padding: '6px', background: '#000', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>OBV_TREND</div>
                        <div style={{
                            color: state.obvTrend === 'BULLISH' ? 'var(--accent-success)' :
                                state.obvTrend === 'BEARISH' ? 'var(--accent-danger)' : 'var(--text-muted)'
                        }}>
                            [{state.obvTrend}]
                        </div>
                    </div>
                </div>
            </div>

            {/* OFI Indicator */}
            <div style={{ marginTop: '16px' }}>
                <div style={{
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    marginBottom: '8px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    borderBottom: '1px solid var(--border-subtle)',
                    paddingBottom: '2px'
                }}>
                    &gt; ORDER_FLOW_IMBALANCE
                </div>
                <OFIIndicator symbol={symbol} />
            </div>

            {/* Volume Delta Indicator */}
            <div style={{ marginTop: '16px' }}>
                <div style={{
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    marginBottom: '8px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    borderBottom: '1px solid var(--border-subtle)',
                    paddingBottom: '2px'
                }}>
                    &gt; VOL_DELTA_CVD
                </div>
                <VolumeDeltaIndicator symbol={symbol} />
            </div>

            {/* VPIN Indicator */}
            <div style={{ marginTop: '16px' }}>
                <div style={{
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    marginBottom: '8px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    borderBottom: '1px solid var(--border-subtle)',
                    paddingBottom: '2px'
                }}>
                    &gt; VPIN_TOXICITY
                </div>
                <VPINIndicator symbol={symbol} />
            </div>
        </div>
    );
};

export default AlphaPanel;
