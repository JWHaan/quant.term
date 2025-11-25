import React, { useEffect, useState, useRef } from 'react';
import { TradeClassifier, VolumeDelta } from '@/utils/tradeClassifier';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface VolumeDeltaIndicatorProps {
    symbol: string;
}

export const VolumeDeltaIndicator: React.FC<VolumeDeltaIndicatorProps> = ({ symbol }) => {
    const [volumeDelta, setVolumeDelta] = useState<VolumeDelta | null>(null);
    const [buySellRatio, setBuySellRatio] = useState<number>(1);
    const [divergence, setDivergence] = useState<{ type: 'bullish' | 'bearish' | null; strength: number }>({ type: null, strength: 0 });
    const classifierRef = useRef<TradeClassifier>(new TradeClassifier());
    const wsRef = useRef<WebSocket | null>(null);
    const priceHistoryRef = useRef<Array<{ timestamp: number; price: number }>>([]);

    useEffect(() => {
        // Connect to Binance trade stream
        const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@aggTrade`);
        wsRef.current = ws;

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                const trade = {
                    id: data.a,
                    price: parseFloat(data.p),
                    quantity: parseFloat(data.q),
                    timestamp: data.T,
                    isBuyerMaker: data.m
                };

                // Classify trade using tick rule
                classifierRef.current.classifyByTickRule(trade);

                // Update price history for divergence detection
                priceHistoryRef.current.push({ timestamp: trade.timestamp, price: trade.price });
                if (priceHistoryRef.current.length > 100) {
                    priceHistoryRef.current.shift();
                }

                // Calculate metrics every 10 trades (to reduce CPU usage)
                if (data.a % 10 === 0) {
                    const delta = classifierRef.current.calculateVolumeDelta(60000); // 1-minute window
                    setVolumeDelta(delta);

                    const ratio = classifierRef.current.getBuySellRatio(60000);
                    setBuySellRatio(ratio);

                    const div = classifierRef.current.detectDivergence(priceHistoryRef.current);
                    setDivergence(div);
                }
            } catch (err) {
                console.error('[VolumeDelta] Parse error:', err);
            }
        };

        ws.onerror = (error) => {
            console.error('[VolumeDelta] WebSocket error:', error);
        };

        return () => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        };
    }, [symbol]);

    useEffect(() => {
        // Reset classifier when symbol changes
        classifierRef.current.reset();
        priceHistoryRef.current = [];
    }, [symbol]);

    if (!volumeDelta) {
        return (
            <div style={{
                padding: '8px',
                background: 'rgba(0,0,0,0.5)',
                borderRadius: '4px',
                fontSize: '10px',
                color: 'var(--text-muted)'
            }}>
                Initializing Volume Delta...
            </div>
        );
    }

    const getDeltaColor = (delta: number): string => {
        if (delta > 0) return '#00ff9d';
        if (delta < 0) return '#ff3b30';
        return '#888';
    };

    const deltaColor = getDeltaColor(volumeDelta.delta);
    const isPositive = volumeDelta.delta > 0;

    return (
        <div style={{
            padding: '8px',
            background: 'rgba(0,0,0,0.8)',
            borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.1)',
            fontFamily: 'var(--font-mono)'
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px'
            }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    VOLUME DELTA (CVD)
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {isPositive ? (
                        <TrendingUp size={12} color="#00ff9d" />
                    ) : (
                        <TrendingDown size={12} color="#ff3b30" />
                    )}
                </div>
            </div>

            {/* Delta Value */}
            <div style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '8px',
                marginBottom: '8px'
            }}>
                <span style={{
                    fontSize: '20px',
                    fontWeight: '600',
                    color: deltaColor
                }}>
                    {isPositive ? '+' : ''}{volumeDelta.delta.toFixed(2)}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    ({volumeDelta.deltaPercent.toFixed(1)}%)
                </span>
            </div>

            {/* Volume Breakdown */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '4px',
                marginBottom: '8px',
                fontSize: '9px'
            }}>
                <div style={{
                    padding: '4px',
                    background: 'rgba(0, 255, 157, 0.1)',
                    borderRadius: '2px'
                }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>Buy Vol</div>
                    <div style={{ color: '#00ff9d', fontWeight: '600' }}>
                        {volumeDelta.buyVolume.toFixed(2)}
                    </div>
                </div>
                <div style={{
                    padding: '4px',
                    background: 'rgba(255, 59, 48, 0.1)',
                    borderRadius: '2px'
                }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>Sell Vol</div>
                    <div style={{ color: '#ff3b30', fontWeight: '600' }}>
                        {volumeDelta.sellVolume.toFixed(2)}
                    </div>
                </div>
            </div>

            {/* Buy/Sell Ratio */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '4px 6px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '2px',
                fontSize: '9px',
                marginBottom: '8px'
            }}>
                <span style={{ color: 'var(--text-muted)' }}>Buy/Sell Ratio:</span>
                <span style={{ color: buySellRatio > 1 ? '#00ff9d' : '#ff3b30', fontWeight: '600' }}>
                    {buySellRatio.toFixed(2)}x
                </span>
            </div>

            {/* Divergence Alert */}
            {divergence.type && divergence.strength > 0.05 && (
                <div style={{
                    padding: '4px 6px',
                    background: divergence.type === 'bullish'
                        ? 'rgba(0, 255, 157, 0.1)'
                        : 'rgba(255, 59, 48, 0.1)',
                    border: `1px solid ${divergence.type === 'bullish' ? '#00ff9d' : '#ff3b30'}`,
                    borderRadius: '2px',
                    fontSize: '9px',
                    color: divergence.type === 'bullish' ? '#00ff9d' : '#ff3b30',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                }}>
                    <Activity size={10} />
                    <span>
                        {divergence.type.toUpperCase()} DIVERGENCE ({(divergence.strength * 100).toFixed(1)}%)
                    </span>
                </div>
            )}

            {/* Info */}
            <div style={{
                marginTop: '8px',
                fontSize: '8px',
                color: 'var(--text-muted)',
                textAlign: 'center'
            }}>
                1-minute rolling window • Tick Rule classification
            </div>
        </div>
    );
};
