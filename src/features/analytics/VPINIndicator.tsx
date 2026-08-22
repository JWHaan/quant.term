import React, { useState, useRef } from 'react';
import { VPINCalculator, VPINResult } from '@/utils/vpinCalculator';
import { TradeClassifier } from '@/utils/tradeClassifier';
import { AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useAggTradeStream } from '@/hooks/useAggTradeStream';

interface VPINIndicatorProps {
    symbol: string;
}

export const VPINIndicator: React.FC<VPINIndicatorProps> = ({ symbol }) => {
    const [vpinResult, setVpinResult] = useState<VPINResult | null>(null);
    const [trend, setTrend] = useState<'increasing' | 'decreasing' | 'stable'>('stable');
    const [bucketProgress, setBucketProgress] = useState<number>(0);
    const vpinCalculatorRef = useRef<VPINCalculator>(new VPINCalculator(500_000, 20));
    const classifierRef = useRef<TradeClassifier>(new TradeClassifier());
    const isConnected = useAggTradeStream(symbol, (trade) => {
        const classifiedTrade = classifierRef.current.classifyFromExchange({
            ...trade,
            quantity: trade.quantity * trade.price,
        });
        const result = vpinCalculatorRef.current.addTrade(classifiedTrade);
        if (result) {
            setVpinResult(result);
            setTrend(vpinCalculatorRef.current.getVPINTrend(10));
        }
        if (trade.id % 20 === 0) {
            setBucketProgress(vpinCalculatorRef.current.getCurrentBucketProgress());
        }
    });

    if (!vpinResult) {
        return (
            <div className="feed-init">
                [{isConnected ? 'INITIALIZING_VPIN' : 'CONNECTING_TRADE_FEED'}]... ({bucketProgress.toFixed(0)}% BUCKET)
            </div>
        );
    }

    const getToxicityColor = (toxicity: string): string => {
        switch (toxicity) {
            case 'low': return 'var(--accent-success)';
            case 'medium': return '#FFD700';
            case 'high': return '#FFA500';
            case 'extreme': return 'var(--accent-danger)';
            default: return 'var(--text-muted)';
        }
    };

    const toxicityColor = getToxicityColor(vpinResult.toxicity);
    const vpinPercent = vpinResult.vpin * 100;

    return (
        <div className={`signal-panel${vpinResult.toxicity === 'extreme' ? ' signal-panel--danger' : ''}`}>
            {/* Header */}
            <div className="signal-head">
                <span className="signal-head__label">
                    &gt; VPIN_TOXICITY
                </span>
                <div className="signal-head__meta">
                    {trend === 'increasing' && <TrendingUp size={10} color="var(--accent-danger)" />}
                    {trend === 'decreasing' && <TrendingDown size={10} color="var(--accent-success)" />}
                    {trend === 'stable' && <Minus size={10} color="var(--text-muted)" />}
                    <span>[{trend.toUpperCase()}]</span>
                </div>
            </div>

            {/* VPIN Value */}
            <div className="signal-hero">
                <span className="signal-hero__value tnum" style={{ color: toxicityColor }}>
                    {vpinResult.vpin.toFixed(3)}
                </span>
                <span className="signal-hero__tag" style={{ color: toxicityColor }}>
                    [{vpinResult.toxicity}]
                </span>
            </div>

            {/* Visual Bar */}
            <div className="signal-meter signal-meter--thick">
                <div
                    className="signal-meter__fill"
                    style={{
                        left: 0,
                        width: `${Math.min(vpinPercent, 100)}%`,
                        background: toxicityColor
                    }}
                />
            </div>

            {/* Bucket Progress */}
            <div className="signal-bucket">
                <div className="signal-bucket__row">
                    <span className="signal-bucket__key">CURRENT_BUCKET:</span>
                    <span className="tnum">{bucketProgress.toFixed(1)}%</span>
                </div>
                <div className="signal-meter signal-meter--hairline">
                    <div
                        className="signal-meter__fill"
                        style={{
                            left: 0,
                            width: `${bucketProgress}%`,
                            background: 'var(--accent-primary)',
                            transition: 'width 0.1s'
                        }}
                    />
                </div>
            </div>

            {/* Details */}
            <div className="signal-grid">
                <div>
                    <span className="signal-kv__key">BUCKETS:</span>
                    <span className="signal-kv__val tnum" style={{ color: 'var(--text-primary)' }}>
                        {vpinResult.bucketsFilled}
                    </span>
                </div>
                <div>
                    <span className="signal-kv__key">BUCKET_VOL:</span>
                    <span className="signal-kv__val tnum" style={{ color: 'var(--text-primary)' }}>
                        {vpinResult.currentBucket.totalVolume.toFixed(1)}
                    </span>
                </div>
            </div>

            {/* Extreme Warning */}
            {vpinResult.toxicity === 'extreme' && (
                <div className="signal-alert signal-alert--sell signal-alert--pulse">
                    <AlertTriangle size={10} />
                    <span>&gt;&gt; HIGH_TOXICITY_DETECTED</span>
                </div>
            )}

            {/* Info */}
            <div className="signal-note">
                $500K QUOTE BUCKETS · 20-BUCKET ROLLING ESTIMATE · EXPERIMENTAL
            </div>
        </div>
    );
};
