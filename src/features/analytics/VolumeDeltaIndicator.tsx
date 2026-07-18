import React, { useState, useRef } from 'react';
import { TradeClassifier, VolumeDelta } from '@/utils/tradeClassifier';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { useAggTradeStream } from '@/hooks/useAggTradeStream';

interface VolumeDeltaIndicatorProps {
    symbol: string;
}

export const VolumeDeltaIndicator: React.FC<VolumeDeltaIndicatorProps> = ({ symbol }) => {
    const [volumeDelta, setVolumeDelta] = useState<VolumeDelta | null>(null);
    const [buySellRatio, setBuySellRatio] = useState<number>(1);
    const [divergence, setDivergence] = useState<{ type: 'bullish' | 'bearish' | null; strength: number }>({ type: null, strength: 0 });
    const classifierRef = useRef<TradeClassifier>(new TradeClassifier());
    const priceHistoryRef = useRef<Array<{ timestamp: number; price: number }>>([]);

    const isConnected = useAggTradeStream(symbol, (trade) => {
        classifierRef.current.classifyFromExchange(trade);
        priceHistoryRef.current.push({ timestamp: trade.timestamp, price: trade.price });
        if (priceHistoryRef.current.length > 100) priceHistoryRef.current.shift();

        if (trade.id % 10 === 0) {
            setVolumeDelta(classifierRef.current.calculateVolumeDelta(60_000));
            setBuySellRatio(classifierRef.current.getBuySellRatio(60_000));
            setDivergence(classifierRef.current.detectDivergence(priceHistoryRef.current));
        }
    });

    if (!volumeDelta) {
        return (
            <div style={{
                padding: '8px',
                background: 'rgba(0,0,0,0.5)',
                fontSize: '10px',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)'
            }}>
                [{isConnected ? 'INITIALIZING_CVD' : 'CONNECTING_TRADE_FEED'}]...
            </div>
        );
    }

    const getDeltaColor = (delta: number): string => {
        if (delta > 0) return 'var(--accent-success)';
        if (delta < 0) return 'var(--accent-danger)';
        return 'var(--text-muted)';
    };

    const deltaColor = getDeltaColor(volumeDelta.delta);
    const isPositive = volumeDelta.delta > 0;

    return (
        <div style={{
            padding: '8px',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-subtle)',
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
                    &gt; VOLUME_DELTA_CVD
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {isPositive ? (
                        <TrendingUp size={12} color="var(--accent-success)" />
                    ) : (
                        <TrendingDown size={12} color="var(--accent-danger)" />
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
                    fontWeight: 'bold',
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
                    background: 'rgba(51, 255, 0, 0.05)',
                    border: '1px solid var(--accent-success)'
                }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>BUY_VOL</div>
                    <div style={{ color: 'var(--accent-success)', fontWeight: 'bold' }}>
                        {volumeDelta.buyVolume.toFixed(2)}
                    </div>
                </div>
                <div style={{
                    padding: '4px',
                    background: 'rgba(255, 0, 0, 0.05)',
                    border: '1px solid var(--accent-danger)'
                }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>SELL_VOL</div>
                    <div style={{ color: 'var(--accent-danger)', fontWeight: 'bold' }}>
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
                background: '#000',
                border: '1px solid var(--border-subtle)',
                fontSize: '9px',
                marginBottom: '8px'
            }}>
                <span style={{ color: 'var(--text-muted)' }}>BUY/SELL_RATIO:</span>
                <span style={{ color: buySellRatio > 1 ? 'var(--accent-success)' : 'var(--accent-danger)', fontWeight: 'bold' }}>
                    {buySellRatio.toFixed(2)}x
                </span>
            </div>

            {/* Divergence Alert */}
            {divergence.type && divergence.strength > 0.05 && (
                <div style={{
                    padding: '4px 6px',
                    background: divergence.type === 'bullish'
                        ? 'rgba(51, 255, 0, 0.1)'
                        : 'rgba(255, 0, 0, 0.1)',
                    border: `1px solid ${divergence.type === 'bullish' ? 'var(--accent-success)' : 'var(--accent-danger)'}`,
                    fontSize: '9px',
                    color: divergence.type === 'bullish' ? 'var(--accent-success)' : 'var(--accent-danger)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                }}>
                    <Activity size={10} />
                    <span>
                        &gt;&gt; {divergence.type.toUpperCase()}_DIVERGENCE ({(divergence.strength * 100).toFixed(1)}%)
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
                1-MIN WINDOW · BINANCE TAKER-SIDE CLASSIFICATION
            </div>
        </div>
    );
};
