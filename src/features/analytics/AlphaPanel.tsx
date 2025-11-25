
import React, { useEffect, useState } from 'react';
import AlphaWorker from '@/workers/alphaWorker?worker';
import type { AlphaWorkerOutput } from '@/workers/alphaWorker';
import { TrendingUp, Activity, Zap } from 'lucide-react';
import { OFIIndicator } from './OFIIndicator';
import { VolumeDeltaIndicator } from './VolumeDeltaIndicator';

const BINANCE_REST_URL = 'https://api.binance.com';

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
        const worker = new AlphaWorker();

        worker.onmessage = (e: MessageEvent<AlphaWorkerOutput>) => {
            if (!cancelled && e.data.symbol === symbol) {
                setState(prev => ({
                    ...prev,
                    ...e.data,
                    loaded: true
                }));
            }
        };

        const fetchData = async () => {
            try {
                // Fetch 500 candles for robust calculation
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

                // Offload calculations to worker
                worker.postMessage({ symbol, data });

            } catch (error) {
                console.error('[AlphaPanel] Failed to fetch data:', error);
            }
        };

        fetchData();
        const id = setInterval(fetchData, 15000);

        return () => {
            cancelled = true;
            clearInterval(id);
            worker.terminate();
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
                CALCULATING ALPHA...
            </div>
        );
    }

    const getScoreColor = (score: number) => {
        if (score > 20) return 'var(--accent-primary)';
        if (score < -20) return 'var(--accent-danger)';
        return 'var(--text-muted)';
    };

    const getRegimeColor = (regime: string) => {
        switch (regime) {
            case 'BULL': return 'var(--accent-primary)';
            case 'BEAR': return 'var(--accent-danger)';
            case 'VOLATILE': return '#FFD700'; // Gold
            default: return 'var(--text-muted)';
        }
    };

    return (
        <div style={{ padding: '12px', height: '100%', overflowY: 'auto' }}>
            {/* Top Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                <div style={{
                    background: 'rgba(255,255,255,0.03)',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid rgba(255,255,255,0.05)'
                }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>MARKET REGIME</div>
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
                        {state.marketCondition}
                    </div>
                </div>

                <div style={{
                    background: 'rgba(255,255,255,0.03)',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid rgba(255,255,255,0.05)'
                }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>ALPHA SCORE</div>
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
                    letterSpacing: '1px'
                }}>
                    Factor Analysis
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {[
                        { label: 'Trend', score: state.scores.trend, val: state.adx.toFixed(1) + ' ADX' },
                        { label: 'Momentum', score: state.scores.momentum, val: state.rsi.toFixed(1) + ' RSI' },
                        { label: 'Volatility', score: state.scores.volatility, val: state.atrPercent.toFixed(2) + '% ATR' },
                        { label: 'Volume', score: state.scores.volume, val: state.obvTrend }
                    ].map((factor) => (
                        <div key={factor.label} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '11px',
                            padding: '4px 8px',
                            background: 'rgba(255,255,255,0.02)',
                            borderRadius: '2px'
                        }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{factor.label}</span>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{factor.val}</span>
                                <span style={{
                                    color: getScoreColor(factor.score),
                                    fontWeight: '600',
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
                    letterSpacing: '1px'
                }}>
                    Deep Dive
                </div>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                    fontSize: '11px'
                }}>
                    <div style={{ padding: '6px', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>Hurst Exp</div>
                        <div style={{ color: '#fff' }}>{state.hurst.toFixed(3)}</div>
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{state.regime}</div>
                    </div>
                    <div style={{ padding: '6px', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>OBV Trend</div>
                        <div style={{
                            color: state.obvTrend === 'BULLISH' ? 'var(--accent-primary)' :
                                state.obvTrend === 'BEARISH' ? 'var(--accent-danger)' : 'var(--text-muted)'
                        }}>
                            {state.obvTrend}
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
                    letterSpacing: '1px'
                }}>
                    Order Flow Imbalance
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
                    letterSpacing: '1px'
                }}>
                    Volume Delta (CVD)
                </div>
                <VolumeDeltaIndicator symbol={symbol} />
            </div>
        </div>
    );
};

export default AlphaPanel;
