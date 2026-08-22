import React, { useCallback, useEffect, useState } from 'react';
import TerminalChart, { type IndicatorToggles } from '@/features/charts/TerminalChart';
import HeatmapStrip from '@/features/charts/HeatmapStrip';
import DataQualityBadge from '@/ui/DataQualityBadge';
import { provenanceRegistry } from '@/services/provenanceEngine';
import { useChartDataFeed } from '@/hooks/useChartDataFeed';
import type { FeedStatus } from '@/types/common';

const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;

interface ChartContainerProps {
    symbol?: string;
}

const INDICATOR_BUTTONS: Array<{
    key: keyof IndicatorToggles;
    label: string;
}> = [
    { key: 'ema9', label: 'EMA9' },
    { key: 'ema21', label: 'EMA21' },
    { key: 'macd', label: 'MACD' },
    { key: 'rsi', label: 'RSI' },
];

const ChartContainer: React.FC<ChartContainerProps> = ({ symbol = 'btcusdt' }) => {
    const [interval, setInterval] = useState<string>('1m');
    const [indicatorToggles, setIndicatorToggles] = useState<IndicatorToggles>({
        ema9: true,
        ema21: false,
        macd: false,
        rsi: false,
    });
    const [showHeatmap, setShowHeatmap] = useState<boolean>(true);
    const [visibleRange, setVisibleRange] = useState<{ fromTime: number; toTime: number } | null>(null);

    // Data quality tracking is populated by the shared provenance registry.
    const [dataQuality, setDataQuality] = useState<{
        latency: number;
        feedStatus: FeedStatus;
        hasGap: boolean;
    }>({
        latency: 0,
        feedStatus: 'LIVE',
        hasGap: false,
    });

    const feed = useChartDataFeed(symbol, interval, { heatmapEnabled: showHeatmap });
    const handleVisibleRangeChange = useCallback(
        (range: { fromTime: number; toTime: number } | null) => setVisibleRange(range),
        [],
    );

    useEffect(() => {
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
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--chart-bg)',
            }}
        >
            <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
                <TerminalChart
                    symbol={symbol}
                    interval={interval}
                    candles={feed.candles}
                    isLoading={feed.isLoading}
                    error={feed.error}
                    isConnected={feed.isConnected}
                    indicatorToggles={indicatorToggles}
                    onVisibleRangeChange={handleVisibleRangeChange}
                />
                <div className="chart-toolbar">
                    <DataQualityBadge
                        symbol={symbol.toUpperCase()}
                        latency={dataQuality.latency}
                        feedStatus={dataQuality.feedStatus}
                        latencyDistribution={provenanceRegistry
                            .getEngine(symbol.toUpperCase())
                            .getLatencyDistribution()}
                        hasGap={dataQuality.hasGap}
                    />

                    <div className="chart-toolbar__group" role="group" aria-label="Timeframe">
                        {INTERVALS.map((tf) => (
                            <button
                                key={tf}
                                type="button"
                                onClick={() => setInterval(tf)}
                                aria-pressed={interval === tf}
                                aria-label={`Use ${tf} candles`}
                                className={`chart-tool-btn${interval === tf ? ' is-active' : ''}`}
                            >
                                {tf}
                            </button>
                        ))}
                    </div>

                    <div className="chart-toolbar__group" role="group" aria-label="Overlays">
                        <button
                            type="button"
                            onClick={() => setShowHeatmap((previous) => !previous)}
                            aria-pressed={showHeatmap}
                            className={`chart-tool-btn${showHeatmap ? ' is-active' : ''}`}
                        >
                            📊 Heatmap
                        </button>
                        {INDICATOR_BUTTONS.map(({ key, label }) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() =>
                                    setIndicatorToggles((previous) => ({ ...previous, [key]: !previous[key] }))
                                }
                                aria-pressed={indicatorToggles[key]}
                                className={`chart-tool-btn chart-tool-btn--indicator-${key}${
                                    indicatorToggles[key] ? ' is-active' : ''
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {showHeatmap && (
                <HeatmapStrip heatmap={feed.heatmap} visibleRange={visibleRange} height={72} />
            )}
        </div>
    );
};

export default ChartContainer;
