import React, { useEffect, useState } from 'react';
import { useMarketStore } from '@/stores/marketStore';
import { useAlertStore } from '@/stores/alertStore';
import { calculateRSI, calculateBollingerBands, calculateMACD, calculateATR } from '@/utils/indicators';
import { Activity, TrendingUp, TrendingDown, Zap } from 'lucide-react';

const QuantSignalEngine = () => {
    const { selectedSymbol } = useMarketStore();
    const { checkMarketConditions } = useAlertStore();
    const [signals, setSignals] = useState<any>(null); // TODO: Define proper type
    const [loading, setLoading] = useState(true);

    // Fetch Data & Calculate Signals
    useEffect(() => {
        const analyzeMarket = async () => {
            try {
                // Fetch 500 candles for 15m timeframe (good for intraday trend)
                const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${selectedSymbol}&interval=15m&limit=200`);
                const rawData = await response.json();

                const data = rawData.map((d: any[]) => ({
                    time: d[0] / 1000,
                    open: parseFloat(d[1]),
                    high: parseFloat(d[2]),
                    low: parseFloat(d[3]),
                    close: parseFloat(d[4]),
                    volume: parseFloat(d[5])
                }));

                if (data.length < 50) return;

                const lastClose = data[data.length - 1].close;

                // 1. RSI (14)
                const rsiData = calculateRSI(data, 14);
                const rsi = rsiData[rsiData.length - 1]?.value || 50;

                // 2. Bollinger Bands (20, 2)
                const bbData = calculateBollingerBands(data, 20, 2);
                const bb = bbData[bbData.length - 1];
                const bbPosition = bb ? (lastClose - bb.lower) / (bb.upper - bb.lower) : 0.5; // 0 = Lower, 1 = Upper

                // 3. MACD (12, 26, 9)
                const macdData = calculateMACD(data, 12, 26, 9);
                const macd = macdData[macdData.length - 1];
                const macdSignal = macd ? (macd.histogram > 0 ? 'BULLISH' : 'BEARISH') : 'NEUTRAL';

                // 4. ATR (14) - Volatility
                const atrData = calculateATR(data, 14);
                const atr = atrData[atrData.length - 1]?.value || 0;
                const atrPercent = (atr / lastClose) * 100;

                // Aggregate Score (-100 to +100)
                let score = 0;

                // RSI Scoring
                if (rsi < 30) score += 30; // Oversold -> Buy
                else if (rsi > 70) score -= 30; // Overbought -> Sell

                // BB Scoring
                if (bbPosition < 0.1) score += 20; // Near Lower Band -> Buy
                else if (bbPosition > 0.9) score -= 20; // Near Upper Band -> Sell

                // MACD Scoring
                if (macdSignal === 'BULLISH') score += 20;
                else score -= 20;

                const nextSignals = {
                    rsi,
                    bbPosition,
                    macdSignal,
                    atrPercent,
                    score,
                    price: lastClose
                };

                // Only update state when values meaningfully change to avoid noisy re-renders
                setSignals((prev: any) => {
                    if (!prev) {
                        return nextSignals;
                    }

                    const diff = {
                        rsi: Math.abs(prev.rsi - nextSignals.rsi),
                        bb: Math.abs(prev.bbPosition - nextSignals.bbPosition),
                        atr: Math.abs(prev.atrPercent - nextSignals.atrPercent),
                        score: Math.abs(prev.score - nextSignals.score),
                    };

                    const macdChanged = prev.macdSignal !== nextSignals.macdSignal;
                    const meaningfulChange =
                        diff.rsi > 0.5 ||
                        diff.bb > 0.02 ||
                        diff.atr > 0.1 ||
                        diff.score >= 1 ||
                        macdChanged;

                    return meaningfulChange ? nextSignals : prev;
                });

                // Check alert conditions
                checkMarketConditions({
                    symbol: selectedSymbol,
                    price: lastClose,
                    rsi,
                    signal: score > 40 ? 'STRONG BUY' : score > 10 ? 'BUY' : score < -40 ? 'STRONG SELL' : score < -10 ? 'SELL' : 'NEUTRAL',
                    volumeRatio: 1, // TODO: Calculate actual volume ratio
                    ofi: 0 // TODO: Get from OrderFlowImbalance
                });

            } catch (error) {
                console.error("Quant Engine Error:", error);
            } finally {
                // Once we've run at least once, stop showing the initializing state
                setLoading(false);
            }
        };

        setLoading(true);
        analyzeMarket();
        const interval = setInterval(analyzeMarket, 5000); // Update every 5s
        return () => clearInterval(interval);
    }, [selectedSymbol, checkMarketConditions]);

    if (loading || !signals) {
        return (
            <div style={{ padding: '16px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                INITIALIZING_QUANT_ENGINE...
            </div>
        );
    }

    // Determine Master Signal
    let masterSignal = "NEUTRAL";
    let signalColor = "var(--text-secondary)";

    if (signals.score > 40) { masterSignal = "STRONG_BUY"; signalColor = "var(--accent-success)"; }
    else if (signals.score > 10) { masterSignal = "BUY"; signalColor = "var(--accent-success)"; }
    else if (signals.score < -40) { masterSignal = "STRONG_SELL"; signalColor = "var(--accent-danger)"; }
    else if (signals.score < -10) { masterSignal = "SELL"; signalColor = "var(--accent-danger)"; }

    return (
        <div style={{
            height: '100%',
            padding: '16px',
            fontFamily: 'var(--font-mono)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            overflowY: 'auto',
            background: 'var(--bg-panel)'
        }}>
            {/* Master Signal Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '12px'
            }}>
                <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px' }}>ALGORITHM_SIGNAL</div>
                    <div className={signals.score > 40 || signals.score < -40 ? "text-glow" : ""} style={{ fontSize: '24px', fontWeight: 'bold', color: signalColor, letterSpacing: '-1px' }}>
                        [{masterSignal}]
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px' }}>CONFIDENCE</div>
                    <div style={{ fontSize: '18px', color: 'var(--text-primary)' }}>{Math.abs(signals.score)}%</div>
                </div>
            </div>

            {/* Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

                {/* RSI */}
                <div style={{ background: 'rgba(51, 255, 0, 0.05)', padding: '8px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-secondary)' }}>
                        <span>RSI(14)</span>
                        <span style={{ color: signals.rsi > 70 ? 'var(--accent-danger)' : signals.rsi < 30 ? 'var(--accent-success)' : 'var(--text-primary)' }}>
                            {signals.rsi.toFixed(1)}
                        </span>
                    </div>
                    <div style={{ width: '100%', height: '4px', background: '#000', marginTop: '6px', position: 'relative', border: '1px solid var(--border-subtle)' }}>
                        <div style={{
                            position: 'absolute',
                            left: `${signals.rsi}%`,
                            top: '-2px',
                            width: '2px',
                            height: '6px',
                            background: 'var(--text-primary)'
                        }} />
                    </div>
                </div>

                {/* MACD */}
                <div style={{ background: 'rgba(51, 255, 0, 0.05)', padding: '8px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-secondary)' }}>
                        <span>MOMENTUM</span>
                        <span style={{ color: signals.macdSignal === 'BULLISH' ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                            {signals.macdSignal}
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                        {signals.macdSignal === 'BULLISH' ? <TrendingUp size={12} color="var(--accent-success)" /> : <TrendingDown size={12} color="var(--accent-danger)" />}
                        <span style={{ fontSize: '10px', color: 'var(--text-primary)' }}>TREND_FOLLOWING</span>
                    </div>
                </div>

                {/* Volatility (ATR) */}
                <div style={{ background: 'rgba(51, 255, 0, 0.05)', padding: '8px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-secondary)' }}>
                        <span>VOLATILITY</span>
                        <span style={{ color: 'var(--text-primary)' }}>{signals.atrPercent.toFixed(2)}%</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                        <Zap size={12} color={signals.atrPercent > 1 ? "var(--accent-warning)" : "var(--text-secondary)"} />
                        <span style={{ fontSize: '10px', color: signals.atrPercent > 1 ? "var(--accent-warning)" : "var(--text-secondary)" }}>
                            {signals.atrPercent > 1 ? "HIGH_EXPANSION" : "COMPRESSED"}
                        </span>
                    </div>
                </div>

                {/* Bollinger Position */}
                <div style={{ background: 'rgba(51, 255, 0, 0.05)', padding: '8px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-secondary)' }}>
                        <span>BB_POSITION</span>
                        <span style={{ color: 'var(--text-primary)' }}>{(signals.bbPosition * 100).toFixed(0)}%</span>
                    </div>
                    <div style={{ width: '100%', height: '4px', background: '#000', marginTop: '6px', position: 'relative', border: '1px solid var(--border-subtle)' }}>
                        <div style={{
                            position: 'absolute',
                            left: `${Math.min(Math.max(signals.bbPosition * 100, 0), 100)}%`,
                            top: '-2px',
                            width: '2px',
                            height: '6px',
                            background: 'var(--text-primary)'
                        }} />
                    </div>
                </div>

            </div>

            {/* Alpha Insight */}
            <div style={{
                marginTop: 'auto',
                padding: '10px',
                background: 'rgba(51, 255, 0, 0.1)',
                border: '1px solid var(--accent-primary)',
                display: 'flex',
                gap: '8px'
            }}>
                <Activity size={14} color="var(--accent-primary)" style={{ marginTop: '2px' }} />
                <div>
                    <div style={{ fontSize: '10px', color: 'var(--accent-primary)', fontWeight: 'bold', marginBottom: '2px' }}>&gt; QUANT_INSIGHT</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                        {masterSignal.includes('BUY')
                            ? "MOMENTUM AND MEAN REVERSION INDICATORS ALIGNED BULLISH. VOLATILITY SUPPORTS EXPANSION."
                            : masterSignal.includes('SELL')
                                ? "OVERBOUGHT CONDITIONS DETECTED WITH BEARISH MOMENTUM DIVERGENCE. RISK OF REVERSAL."
                                : "MARKET IN EQUILIBRIUM. AWAITING VOLATILITY BREAKOUT OR CLEAR TREND CONFIRMATION."}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default React.memo(QuantSignalEngine);
