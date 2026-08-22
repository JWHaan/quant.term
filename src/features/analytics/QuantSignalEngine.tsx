import React, { useEffect, useState } from 'react';
import { Activity, TrendingUp, TrendingDown, Zap } from 'lucide-react';
import { useSelectedSymbol } from '@/stores/marketStore';
import { useCheckMarketConditions } from '@/stores/alertStore';
import { calculateRSI, calculateBollingerBands, calculateMACD, calculateATR } from '@/utils/indicators';
import { BINANCE_REST_URL } from '@/constants/config';

const ANALYSIS_INTERVAL = '15m';
const ANALYSIS_LIMIT = 200;
const ANALYSIS_POLL_INTERVAL_MS = 30_000;
const BUY_SIGNAL_THRESHOLD = 10;
const STRONG_BUY_SIGNAL_THRESHOLD = 40;
const SELL_SIGNAL_THRESHOLD = -10;
const STRONG_SELL_SIGNAL_THRESHOLD = -40;

export interface QuantSignal {
    rsi: number;
    bbPosition: number;
    macdSignal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    atrPercent: number;
    score: number;
    price: number;
}

type CandleRow = [number, string, string, string, string, string];

type MarketAlertPayload = {
    symbol: string;
    price: number;
    rsi?: number;
    macd?: number;
    volumeRatio?: number;
    signal?: string;
    ofi?: number;
    liquidation?: number;
};

function parseCandle(d: CandleRow) {
    return {
        time: d[0] / 1000,
        open: parseFloat(d[1]),
        high: parseFloat(d[2]),
        low: parseFloat(d[3]),
        close: parseFloat(d[4]),
        volume: parseFloat(d[5]),
    };
}

function getSignalLabel(score: number): 'STRONG BUY' | 'BUY' | 'SELL' | 'STRONG SELL' | 'NEUTRAL' {
    if (score > STRONG_BUY_SIGNAL_THRESHOLD) return 'STRONG BUY';
    if (score > BUY_SIGNAL_THRESHOLD) return 'BUY';
    if (score < STRONG_SELL_SIGNAL_THRESHOLD) return 'STRONG SELL';
    if (score < SELL_SIGNAL_THRESHOLD) return 'SELL';
    return 'NEUTRAL';
}

function getMasterSignal(score: number): 'NEUTRAL' | 'BUY' | 'SELL' | 'STRONG_BUY' | 'STRONG_SELL' {
    if (score > STRONG_BUY_SIGNAL_THRESHOLD) return 'STRONG_BUY';
    if (score > BUY_SIGNAL_THRESHOLD) return 'BUY';
    if (score < STRONG_SELL_SIGNAL_THRESHOLD) return 'STRONG_SELL';
    if (score < SELL_SIGNAL_THRESHOLD) return 'SELL';
    return 'NEUTRAL';
}

function getSignalColor(signal: ReturnType<typeof getMasterSignal>): string {
    if (signal.includes('BUY')) return 'var(--accent-success)';
    if (signal.includes('SELL')) return 'var(--accent-danger)';
    return 'var(--text-secondary)';
}

const QuantSignalEngine = () => {
    const selectedSymbol = useSelectedSymbol();
    const checkMarketConditions = useCheckMarketConditions();
    const [signals, setSignals] = useState<QuantSignal | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<number | null>(null);

    useEffect(() => {
        let disposed = false;
        let activeController: AbortController | null = null;

        const analyzeMarket = async () => {
            activeController?.abort();
            const controller = new AbortController();
            activeController = controller;
            let timedOut = false;
            const timeout = window.setTimeout(() => {
                timedOut = true;
                controller.abort();
            }, 8_000);

            try {
                const response = await fetch(
                    `${BINANCE_REST_URL}/api/v3/klines?symbol=${encodeURIComponent(selectedSymbol)}&interval=${ANALYSIS_INTERVAL}&limit=${ANALYSIS_LIMIT}`,
                    { signal: controller.signal },
                );
                if (!response.ok) throw new Error(`Binance returned ${response.status}`);
                const payload: unknown = await response.json();
                if (!Array.isArray(payload)) throw new Error('Unexpected kline response');
                const rawData = payload as CandleRow[];
                const data = rawData.map(parseCandle);
                if (data.length < 50) throw new Error('Insufficient kline history');

                const lastClose = data.at(-1)?.close ?? 0;
                const rsi = calculateRSI(data, 14).at(-1)?.value ?? 50;

                const bb = calculateBollingerBands(data, 20, 2).at(-1);
                const bbPosition = bb ? (lastClose - bb.lower) / (bb.upper - bb.lower) : 0.5;

                const macd = calculateMACD(data, 12, 26, 9).at(-1);
                const macdSignal: QuantSignal['macdSignal'] = macd ? (macd.histogram > 0 ? 'BULLISH' : 'BEARISH') : 'NEUTRAL';

                const atr = calculateATR(data, 14).at(-1)?.value ?? 0;
                const atrPercent = lastClose !== 0 ? (atr / lastClose) * 100 : 0;

                let score = 0;
                if (rsi < 30) score += 30;
                else if (rsi > 70) score -= 30;
                if (bbPosition < 0.1) score += 20;
                else if (bbPosition > 0.9) score -= 20;
                if (macdSignal === 'BULLISH') score += 20;
                else if (macdSignal === 'BEARISH') score -= 20;

                const nextSignals: QuantSignal = { rsi, bbPosition, macdSignal, atrPercent, score, price: lastClose };
                if (disposed || controller.signal.aborted || activeController !== controller) return;

                setSignals((prev) => {
                    if (!prev) return nextSignals;
                    const meaningfulChange =
                        Math.abs(prev.rsi - nextSignals.rsi) > 0.5 ||
                        Math.abs(prev.bbPosition - nextSignals.bbPosition) > 0.02 ||
                        Math.abs(prev.atrPercent - nextSignals.atrPercent) > 0.1 ||
                        Math.abs(prev.score - nextSignals.score) >= 1 ||
                        prev.macdSignal !== nextSignals.macdSignal;
                    return meaningfulChange ? nextSignals : prev;
                });

                const alertPayload: MarketAlertPayload = {
                    symbol: selectedSymbol,
                    price: lastClose,
                    rsi,
                    signal: getSignalLabel(score),
                    volumeRatio: 1,
                    ofi: 0,
                };
                checkMarketConditions(alertPayload);
                setLastUpdated(Date.now());
                setError(null);
            } catch (caught) {
                if (disposed || (controller.signal.aborted && !timedOut) || activeController !== controller) return;
                console.error('[QuantSignalEngine] Error:', caught);
                setError(timedOut ? 'Signal request timed out' : caught instanceof Error ? caught.message : 'Signal data unavailable');
            } finally {
                window.clearTimeout(timeout);
                if (!disposed && activeController === controller) setLoading(false);
            }
        };

        analyzeMarket();
        const interval = setInterval(analyzeMarket, ANALYSIS_POLL_INTERVAL_MS);
        return () => {
            disposed = true;
            clearInterval(interval);
            activeController?.abort();
        };
    }, [selectedSymbol, checkMarketConditions]);

    if (loading || !signals) {
        return (
            <div className="panel-body">
                {error ? `SIGNAL_ENGINE_UNAVAILABLE · ${error}` : 'INITIALIZING_QUANT_ENGINE…'}
            </div>
        );
    }

    const masterSignal = getMasterSignal(signals.score);
    const signalColor = getSignalColor(masterSignal);

    return (
        <div className="panel-scroll" style={{ fontFamily: 'var(--font-mono)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {error && (
                <div className="freshness-line panel-degraded">
                    DEGRADED · Latest signal retained · {error}
                </div>
            )}
            <div className="panel-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <div>
                    <div className="stat-card__label" style={{ color: 'var(--text-secondary)' }}>HEURISTIC_SIGNAL · 15M</div>
                    <div className={`${Math.abs(signals.score) > STRONG_BUY_SIGNAL_THRESHOLD ? 'text-glow' : ''} tnum`} style={{ fontSize: '24px', fontWeight: 'bold', color: signalColor, letterSpacing: '-1px' }}>
                        [{masterSignal}]
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div className="stat-card__label" style={{ color: 'var(--text-secondary)' }}>MODEL SCORE</div>
                    <div className="tnum" style={{ fontSize: '18px', color: 'var(--text-primary)' }}>{Math.abs(signals.score)}%</div>
                </div>
            </div>

            <div className="panel-body" style={{ paddingTop: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="stat-card">
                    <div className="stat-card__row">
                        <span>RSI(14)</span>
                        <span className="tnum" style={{ color: signals.rsi > 70 ? 'var(--accent-danger)' : signals.rsi < 30 ? 'var(--accent-success)' : 'var(--text-primary)' }}>{signals.rsi.toFixed(1)}</span>
                    </div>
                    <div className="gauge-track">
                        <div className="gauge-track__marker" style={{ left: `${signals.rsi}%` }} />
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-card__row">
                        <span>MOMENTUM</span>
                        <span style={{ color: signals.macdSignal === 'BULLISH' ? 'var(--accent-success)' : signals.macdSignal === 'BEARISH' ? 'var(--accent-danger)' : 'var(--text-secondary)' }}>
                            {signals.macdSignal}
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                        {signals.macdSignal === 'BULLISH' ? <TrendingUp size={12} color="var(--accent-success)" /> : signals.macdSignal === 'BEARISH' ? <TrendingDown size={12} color="var(--accent-danger)" /> : <Activity size={12} color="var(--text-secondary)" />}
                        <span style={{ fontSize: '10px', color: 'var(--text-primary)' }}>TREND_FOLLOWING</span>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-card__row">
                        <span>VOLATILITY</span>
                        <span className="tnum" style={{ color: 'var(--text-primary)' }}>{signals.atrPercent.toFixed(2)}%</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                        <Zap size={12} color={signals.atrPercent > 1 ? 'var(--accent-warning)' : 'var(--text-secondary)'} />
                        <span style={{ fontSize: '10px', color: signals.atrPercent > 1 ? 'var(--accent-warning)' : 'var(--text-secondary)' }}>
                            {signals.atrPercent > 1 ? 'HIGH_EXPANSION' : 'COMPRESSED'}
                        </span>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-card__row">
                        <span>BB_POSITION</span>
                        <span className="tnum" style={{ color: 'var(--text-primary)' }}>{(signals.bbPosition * 100).toFixed(0)}%</span>
                    </div>
                    <div className="gauge-track">
                        <div className="gauge-track__marker" style={{ left: `${Math.min(Math.max(signals.bbPosition * 100, 0), 100)}%` }} />
                    </div>
                </div>
            </div>

            <div className="panel-body insight-box" style={{ marginTop: 'auto', paddingTop: 0 }}>
                <Activity size={14} color="var(--accent-primary)" style={{ marginTop: '2px' }} />
                <div>
                    <div className="insight-box__title">&gt; QUANT_INSIGHT</div>
                    <div className="insight-box__body">
                        {masterSignal.includes('BUY')
                            ? 'RSI, BOLLINGER POSITION, AND MACD INPUTS CURRENTLY LEAN BULLISH.'
                            : masterSignal.includes('SELL')
                                ? 'RSI, BOLLINGER POSITION, AND MACD INPUTS CURRENTLY LEAN BEARISH.'
                                : 'THE INPUTS ARE MIXED. NO DIRECTIONAL EDGE IS IMPLIED BY THIS HEURISTIC.'}
                    </div>
                </div>
            </div>
            <div className="freshness-line">BINANCE SPOT · Refresh 30s · {lastUpdated ? `Updated ${new Date(lastUpdated).toLocaleTimeString()}` : 'Waiting'} · Not investment advice</div>
        </div>
    );
};

export default React.memo(QuantSignalEngine);
