import React, { useEffect, useState, useRef } from 'react';
import { VPINCalculator, VPINResult } from '@/utils/vpinCalculator';
import { TradeClassifier } from '@/utils/tradeClassifier';
import { AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface VPINIndicatorProps {
    symbol: string;
}

export const VPINIndicator: React.FC<VPINIndicatorProps> = ({ symbol }) => {
    const [vpinResult, setVpinResult] = useState<VPINResult | null>(null);
    const [trend, setTrend] = useState<'increasing' | 'decreasing' | 'stable'>('stable');
    const [bucketProgress, setBucketProgress] = useState<number>(0);
    const vpinCalculatorRef = useRef<VPINCalculator>(new VPINCalculator(100, 50)); // 100 BTC buckets, 50 bucket window
    const classifierRef = useRef<TradeClassifier>(new TradeClassifier());
    const wsRef = useRef<WebSocket | null>(null);

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

                // Classify trade
                const classifiedTrade = classifierRef.current.classifyByTickRule(trade);

                // Add to VPIN calculator
                const result = vpinCalculatorRef.current.addTrade(classifiedTrade);

                if (result) {
                    setVpinResult(result);
                    const vpinTrend = vpinCalculatorRef.current.getVPINTrend(10);
                    setTrend(vpinTrend);
                }

                // Update bucket progress
                const progress = vpinCalculatorRef.current.getCurrentBucketProgress();
                setBucketProgress(progress);

            } catch (err) {
                console.error('[VPIN] Parse error:', err);
            }
        };

        ws.onerror = (error) => {
            console.error('[VPIN] WebSocket error:', error);
        };

        return () => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        };
    }, [symbol]);

    useEffect(() => {
        // Reset calculators when symbol changes
        vpinCalculatorRef.current.reset();
        classifierRef.current.reset();
    }, [symbol]);

    if (!vpinResult) {
        return (
            <div style={{
                padding: '8px',
                background: 'rgba(0,0,0,0.5)',
                fontSize: '10px',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)'
            }}>
                [INITIALIZING_VPIN]... ({bucketProgress.toFixed(0)}% BUCKET)
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
        <div style={{
            padding: '8px',
            background: 'var(--bg-panel)',
            border: `1px solid ${vpinResult.toxicity === 'extreme' ? 'var(--accent-danger)' : 'var(--border-subtle)'}`,
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
                    &gt; VPIN_TOXICITY
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {trend === 'increasing' && <TrendingUp size={10} color="var(--accent-danger)" />}
                    {trend === 'decreasing' && <TrendingDown size={10} color="var(--accent-success)" />}
                    {trend === 'stable' && <Minus size={10} color="var(--text-muted)" />}
                    <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>
                        [{trend.toUpperCase()}]
                    </span>
                </div>
            </div>

            {/* VPIN Value */}
            <div style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '8px',
                marginBottom: '8px'
            }}>
                <span style={{
                    fontSize: '20px',
                    fontWeight: 'bold',
                    color: toxicityColor
                }}>
                    {vpinResult.vpin.toFixed(3)}
                </span>
                <span style={{
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: toxicityColor,
                    textTransform: 'uppercase'
                }}>
                    [{vpinResult.toxicity}]
                </span>
            </div>

            {/* Visual Bar */}
            <div style={{
                height: '6px',
                background: '#000',
                border: '1px solid var(--border-subtle)',
                marginBottom: '8px',
                position: 'relative'
            }}>
                <div style={{
                    height: '100%',
                    width: `${Math.min(vpinPercent, 100)}%`,
                    background: toxicityColor,
                    transition: 'width 0.3s, background 0.3s'
                }} />
            </div>

            {/* Bucket Progress */}
            <div style={{
                fontSize: '9px',
                color: 'var(--text-secondary)',
                marginBottom: '8px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>CURRENT_BUCKET:</span>
                    <span>{bucketProgress.toFixed(1)}%</span>
                </div>
                <div style={{
                    height: '2px',
                    background: '#000',
                    border: '1px solid var(--border-subtle)'
                }}>
                    <div style={{
                        height: '100%',
                        width: `${bucketProgress}%`,
                        background: 'var(--accent-primary)',
                        transition: 'width 0.1s'
                    }} />
                </div>
            </div>

            {/* Details */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '4px',
                fontSize: '9px',
                color: 'var(--text-secondary)'
            }}>
                <div>
                    <span style={{ color: 'var(--text-muted)' }}>BUCKETS:</span>
                    <span style={{ marginLeft: '4px', color: 'var(--text-primary)' }}>
                        {vpinResult.bucketsFilled}
                    </span>
                </div>
                <div>
                    <span style={{ color: 'var(--text-muted)' }}>BUCKET_VOL:</span>
                    <span style={{ marginLeft: '4px', color: 'var(--text-primary)' }}>
                        {vpinResult.currentBucket.totalVolume.toFixed(1)}
                    </span>
                </div>
            </div>

            {/* Extreme Warning */}
            {vpinResult.toxicity === 'extreme' && (
                <div style={{
                    marginTop: '8px',
                    padding: '4px 6px',
                    background: 'rgba(255, 0, 0, 0.2)',
                    border: '1px solid var(--accent-danger)',
                    fontSize: '9px',
                    color: 'var(--accent-danger)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    animation: 'pulse 2s infinite'
                }}>
                    <AlertTriangle size={10} />
                    <span>&gt;&gt; HIGH_TOXICITY_DETECTED</span>
                </div>
            )}

            {/* Info */}
            <div style={{
                marginTop: '8px',
                fontSize: '8px',
                color: 'var(--text-muted)',
                textAlign: 'center'
            }}>
                VOL_BUCKETED • 50_BUCKET_WINDOW
            </div>
        </div>
    );
};
