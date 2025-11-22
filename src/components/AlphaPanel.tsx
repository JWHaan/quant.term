
import React, { useEffect, useState } from 'react';
import AlphaWorker from '@/workers/alphaWorker?worker';
import type { AlphaWorkerOutput } from '@/workers/alphaWorker';
import { TrendingUp, Activity, BarChart2, Zap } from 'lucide-react';

const BINANCE_REST_URL = 'https://api.binance.com';

interface AlphaPanelProps {
    symbol?: string;
    interval?: string;
}

interface AlphaState {
    loaded: boolean;
    regime: 'TRENDING' | 'MEAN_REVERSION' | 'RANDOM_WALK';
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
                fontSize: '11px',
                fontFamily: 'var(--font-mono)'
            }}>
                CALCULATING ALPHA FACTORS...
            </div>
        );
    }

    const getScoreColor = (score: number) => {
        if (score > 20) return 'var(--accent-primary)';
        if (score < -20) return 'var(--accent-danger)';
        return 'var(--text-secondary)';
    };

    return (
        <div style={{
            height: '100%',
            padding: '12px',
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-primary)',
            overflowY: 'auto'
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '8px'
            }}>
                <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1px' }}>MARKET REGIME</div>
                    <div style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: state.regime === 'TRENDING' ? 'var(--accent-primary)' :
                            state.regime === 'MEAN_REVERSION' ? 'var(--accent-warning)' : 'var(--text-secondary)'
                    }}>
                        {state.regime.replace('_', ' ')}
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>HURST</div>
                    <div style={{ fontSize: '14px' }}>{state.hurst.toFixed(2)}</div>
                </div>
            </div>

            {/* Factor Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>

                {/* Trend Factor */}
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <TrendingUp size={12} color="var(--text-muted)" />
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>TREND</span>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: getScoreColor(state.scores.trend) }}>
                        {state.scores.trend > 0 ? '+' : ''}{state.scores.trend.toFixed(0)}
                    </div>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        ADX: {state.adx.toFixed(1)}
                    </div>
                </div>

                {/* Momentum Factor */}
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <Zap size={12} color="var(--text-muted)" />
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>MOMENTUM</span>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: getScoreColor(state.scores.momentum) }}>
                        {state.scores.momentum > 0 ? '+' : ''}{state.scores.momentum.toFixed(0)}
                    </div>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        RSI: {state.rsi.toFixed(1)}
                    </div>
                </div>

                {/* Volatility Factor */}
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <Activity size={12} color="var(--text-muted)" />
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>VOLATILITY</span>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff' }}>
                        {state.scores.volatility.toFixed(0)}%
                    </div>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        ATR: {state.atrPercent.toFixed(2)}%
                    </div>
                </div>

                {/* Volume Factor */}
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <BarChart2 size={12} color="var(--text-muted)" />
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>VOLUME</span>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: getScoreColor(state.scores.volume) }}>
                        {state.scores.volume > 0 ? '+' : ''}{state.scores.volume.toFixed(0)}
                    </div>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        OBV: {state.obvTrend}
                    </div>
                </div>
            </div>

            {/* Alpha Summary */}
            <div style={{
                marginTop: 'auto',
                padding: '10px',
                background: 'rgba(0,255,157,0.05)',
                border: '1px solid var(--accent-primary)',
                borderRadius: '4px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--accent-primary)', fontWeight: 'bold' }}>ALPHA SCORE</span>
                    <span style={{ fontSize: '14px', fontWeight: 'bold', color: getScoreColor(state.scores.total) }}>
                        {state.scores.total > 0 ? '+' : ''}{state.scores.total.toFixed(0)}
                    </span>
                </div>
                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                        width: `${Math.abs(state.scores.total)}%`,
                        height: '100%',
                        background: getScoreColor(state.scores.total),
                        marginLeft: state.scores.total < 0 ? 'auto' : '0',
                        marginRight: state.scores.total > 0 ? 'auto' : '0',
                        transformOrigin: state.scores.total > 0 ? 'left' : 'right'
                    }} />
                </div>
            </div>
        </div>
    );
};

export default AlphaPanel;
