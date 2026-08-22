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
            <div className="feed-init">
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
        <div className="signal-panel">
            {/* Header */}
            <div className="signal-head">
                <span className="signal-head__label">
                    &gt; VOLUME_DELTA_CVD
                </span>
                <div className="signal-head__meta">
                    {isPositive ? (
                        <TrendingUp size={12} color="var(--accent-success)" />
                    ) : (
                        <TrendingDown size={12} color="var(--accent-danger)" />
                    )}
                </div>
            </div>

            {/* Delta Value */}
            <div className="signal-hero">
                <span className="signal-hero__value tnum" style={{ color: deltaColor }}>
                    {isPositive ? '+' : ''}{volumeDelta.delta.toFixed(2)}
                </span>
                <span className="signal-hero__pct tnum">
                    ({volumeDelta.deltaPercent.toFixed(1)}%)
                </span>
            </div>

            {/* Volume Breakdown */}
            <div className="signal-duo">
                <div className="signal-duo__card signal-duo__card--buy">
                    <div className="signal-duo__label">BUY_VOL</div>
                    <div className="signal-duo__value tnum signal-duo__value--buy">
                        {volumeDelta.buyVolume.toFixed(2)}
                    </div>
                </div>
                <div className="signal-duo__card signal-duo__card--sell">
                    <div className="signal-duo__label">SELL_VOL</div>
                    <div className="signal-duo__value tnum signal-duo__value--sell">
                        {volumeDelta.sellVolume.toFixed(2)}
                    </div>
                </div>
            </div>

            {/* Buy/Sell Ratio */}
            <div className="signal-strip">
                <span className="signal-kv__key">BUY/SELL_RATIO:</span>
                <span
                    className="tnum"
                    style={{
                        color: buySellRatio > 1 ? 'var(--accent-success)' : 'var(--accent-danger)',
                        fontWeight: 'bold'
                    }}
                >
                    {buySellRatio.toFixed(2)}x
                </span>
            </div>

            {/* Divergence Alert */}
            {divergence.type && divergence.strength > 0.05 && (
                <div className={`signal-alert ${divergence.type === 'bullish' ? 'signal-alert--buy' : 'signal-alert--sell'}`}>
                    <Activity size={10} />
                    <span>
                        &gt;&gt; {divergence.type.toUpperCase()}_DIVERGENCE ({(divergence.strength * 100).toFixed(1)}%)
                    </span>
                </div>
            )}

            {/* Info */}
            <div className="signal-note">
                1-MIN WINDOW · BINANCE TAKER-SIDE CLASSIFICATION
            </div>
        </div>
    );
};
