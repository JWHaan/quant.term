import React, { useState } from 'react';
import CustomChart from '@/components/CustomChart';
import DataQualityBadge from '@/ui/DataQualityBadge';
import { provenanceRegistry } from '@/services/provenanceEngine';
import type { FeedStatus } from '@/types/common';

const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'];

interface ChartContainerProps {
    symbol?: string;
}

const ChartContainer: React.FC<ChartContainerProps> = ({ symbol = 'btcusdt' }) => {
    const [interval, setInterval] = useState<string>('1m');

    // Data quality tracking (mock – CustomChart does the real work)
    const [dataQuality, setDataQuality] = useState<{
        latency: number;
        feedStatus: FeedStatus;
        hasGap: boolean;
    }>({
        latency: 0,
        feedStatus: 'LIVE',
        hasGap: false,
    });

    // Indicator toggles – expose to the toolbar
    const [indicatorToggles, setIndicatorToggles] = useState<{ ema9: boolean; ema21: boolean; macd: boolean; rsi: boolean }>({
        ema9: true,
        ema21: false,
        macd: false,
        rsi: false,
    });

    const toggleIndicator = (key: keyof typeof indicatorToggles) => {
        setIndicatorToggles(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // Heatmap visibility toggle
    const [showHeatmap, setShowHeatmap] = useState<boolean>(true);

    // Responsive container height using ResizeObserver
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [containerHeight, setContainerHeight] = useState<number>(600);
    React.useEffect(() => {
        if (!containerRef.current) return;
        const ro = new ResizeObserver(entries => {
            for (let entry of entries) {
                const height = entry.contentRect.height;
                if (height) setContainerHeight(height);
            }
        });
        ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, []);

    // Data quality polling (mock)
    React.useEffect(() => {
        const engine = provenanceRegistry.getEngine(symbol.toUpperCase());
        const intervalId = window.setInterval(() => {
            const distribution = engine.getLatencyDistribution();
            const status = engine.getFeedStatus();
            setDataQuality({
                latency: distribution.p50 || 0,
                feedStatus: status,
                hasGap: false,
            });
        }, 1000);
        return () => window.clearInterval(intervalId);
    }, [symbol]);

    return (
        <div
            ref={containerRef}
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                background: 'var(--chart-bg)',
            }}
        >
            {/* Chart */}
            <div style={{ width: '100%', height: '100%' }}>
                <CustomChart
                    symbol={symbol}
                    interval={interval}
                    height={containerHeight}
                    showHeatmap={showHeatmap}
                    indicatorToggles={indicatorToggles}
                />
            </div>

            {/* Toolbar */}
            <div
                style={{
                    position: 'absolute',
                    top: 10,
                    left: 10,
                    right: 10,
                    zIndex: 20,
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                }}
            >
                {/* Data Quality Badge */}
                <DataQualityBadge
                    symbol={symbol.toUpperCase()}
                    latency={dataQuality.latency}
                    feedStatus={dataQuality.feedStatus}
                    latencyDistribution={provenanceRegistry
                        .getEngine(symbol.toUpperCase())
                        .getLatencyDistribution()}
                    hasGap={dataQuality.hasGap}
                />

                {/* Timeframe Selector */}
                <div
                    style={{
                        display: 'flex',
                        gap: '2px',
                        background: 'rgba(15, 23, 42, 0.9)',
                        border: '1px solid rgba(51, 255, 0, 0.2)',
                        padding: '3px',
                        borderRadius: '4px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    }}
                >
                    {INTERVALS.map(tf => (
                        <button
                            key={tf}
                            onClick={() => setInterval(tf)}
                            style={{
                                padding: '4px 10px',
                                background: interval === tf ? 'var(--accent-primary)' : 'transparent',
                                border: 'none',
                                fontSize: '11px',
                                fontWeight: interval === tf ? '600' : '400',
                                color: interval === tf ? '#000' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                fontFamily: 'var(--font-mono)',
                                borderRadius: '2px',
                                transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                                if (interval !== tf) {
                                    e.currentTarget.style.background = 'rgba(51, 255, 0, 0.1)';
                                    e.currentTarget.style.color = 'var(--text-primary)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (interval !== tf) {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = 'var(--text-secondary)';
                                }
                            }}
                        >
                            {tf}
                        </button>
                    ))}
                </div>

                {/* Indicator Controls Group */}
                <div
                    style={{
                        display: 'flex',
                        gap: '4px',
                        background: 'rgba(15, 23, 42, 0.9)',
                        border: '1px solid rgba(51, 255, 0, 0.2)',
                        padding: '3px',
                        borderRadius: '4px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    }}
                >
                    {/* Heatmap Toggle */}
                    <button
                        onClick={() => setShowHeatmap(prev => !prev)}
                        style={{
                            padding: '4px 10px',
                            background: showHeatmap ? 'var(--accent-primary)' : 'transparent',
                            border: 'none',
                            borderRadius: '2px',
                            fontSize: '11px',
                            fontWeight: showHeatmap ? '600' : '400',
                            color: showHeatmap ? '#000' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontFamily: 'var(--font-mono)',
                            transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                            if (!showHeatmap) {
                                e.currentTarget.style.background = 'rgba(51, 255, 0, 0.1)';
                                e.currentTarget.style.color = 'var(--text-primary)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!showHeatmap) {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = 'var(--text-secondary)';
                            }
                        }}
                    >
                        📊 Heatmap
                    </button>

                    {/* Indicator Toggles */}
                    {(['ema9', 'ema21', 'macd', 'rsi'] as const).map(key => {
                        const labels = {
                            ema9: 'EMA9',
                            ema21: 'EMA21',
                            macd: 'MACD',
                            rsi: 'RSI'
                        };
                        const colors = {
                            ema9: '#3b82f6',
                            ema21: '#8b5cf6',
                            macd: '#f59e0b',
                            rsi: '#a855f7'
                        };
                        return (
                            <button
                                key={key}
                                onClick={() => toggleIndicator(key)}
                                style={{
                                    padding: '4px 10px',
                                    background: indicatorToggles[key] ? colors[key] : 'transparent',
                                    border: indicatorToggles[key] ? `1px solid ${colors[key]}` : '1px solid transparent',
                                    borderRadius: '2px',
                                    fontSize: '11px',
                                    fontWeight: indicatorToggles[key] ? '600' : '400',
                                    color: indicatorToggles[key] ? '#fff' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    fontFamily: 'var(--font-mono)',
                                    transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                    if (!indicatorToggles[key]) {
                                        e.currentTarget.style.background = 'rgba(51, 255, 0, 0.1)';
                                        e.currentTarget.style.color = 'var(--text-primary)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!indicatorToggles[key]) {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.color = 'var(--text-secondary)';
                                    }
                                }}
                            >
                                {labels[key]}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default ChartContainer;
