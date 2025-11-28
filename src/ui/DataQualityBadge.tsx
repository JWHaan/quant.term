/**
 * Data Quality Badge Component
 * 
 * Real-time visual indicator of market data quality showing:
 * - Color-coded latency status (green <100ms, yellow 100-500ms, red >500ms)
 * - Hover tooltip with latency distribution
 * - Gap detection indicator
 * - Feed status icon
 */

import React, { useState } from 'react';
import { Activity, AlertTriangle, WifiOff, Clock } from 'lucide-react';
import type { FeedStatus, LatencyDistribution } from '@/types/common';

interface DataQualityBadgeProps {
    symbol: string;
    latency: number;
    feedStatus: FeedStatus;
    latencyDistribution?: LatencyDistribution;
    hasGap?: boolean;
    className?: string;
}

const DataQualityBadge: React.FC<DataQualityBadgeProps> = ({
    symbol,
    latency,
    feedStatus,
    latencyDistribution,
    hasGap = false,
    className = ''
}) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

    // Determine color based on latency
    const getLatencyColor = (): string => {
        if (feedStatus === 'DISCONNECTED') return '#666666';
        if (feedStatus === 'STALE') return '#FF3B30';
        if (latency < 100) return '#00FF9D'; // Green
        if (latency < 500) return '#FFD700'; // Yellow/Gold
        return '#FF3B30'; // Red
    };

    // Get status icon
    const getStatusIcon = () => {
        switch (feedStatus) {
            case 'LIVE':
                return <Activity size={10} />;
            case 'STALE':
                return <Clock size={10} />;
            case 'DISCONNECTED':
                return <WifiOff size={10} />;
            case 'REPLAY':
                return <Activity size={10} style={{ opacity: 0.6 }} />;
            default:
                return <Activity size={10} />;
        }
    };

    // Get quality label
    const getQualityLabel = (): string => {
        if (feedStatus === 'DISCONNECTED') return 'OFFLINE';
        if (feedStatus === 'STALE') return 'STALE';
        if (feedStatus === 'REPLAY') return 'REPLAY';
        if (latency < 100) return 'EXCELLENT';
        if (latency < 200) return 'GOOD';
        if (latency < 500) return 'FAIR';
        return 'POOR';
    };

    const color = getLatencyColor();
    const qualityLabel = getQualityLabel();

    const handleMouseEnter = (e: React.MouseEvent) => {
        setShowTooltip(true);
        setTooltipPosition({ x: e.clientX, y: e.clientY });
    };

    const handleMouseLeave = () => {
        setShowTooltip(false);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (showTooltip) {
            setTooltipPosition({ x: e.clientX, y: e.clientY });
        }
    };

    return (
        <>
            <div
                className={`data-quality-badge ${className}`}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 6px',
                    backgroundColor: `${color}15`,
                    border: `1px solid ${color}`,
                    borderRadius: '3px',
                    fontSize: '9px',
                    fontFamily: 'var(--font-mono)',
                    color: color,
                    cursor: 'help',
                    transition: 'all 0.2s ease'
                }}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onMouseMove={handleMouseMove}
            >
                {getStatusIcon()}
                <span style={{ fontWeight: 600 }}>{latency}ms</span>
                <span style={{ opacity: 0.8 }}>{qualityLabel}</span>
                {hasGap && (
                    <AlertTriangle size={10} style={{ color: '#FFA500' }} />
                )}
            </div>

            {/* Tooltip */}
            {showTooltip && latencyDistribution && (
                <div
                    style={{
                        position: 'fixed',
                        left: tooltipPosition.x + 10,
                        top: tooltipPosition.y + 10,
                        zIndex: 10000,
                        backgroundColor: '#1A1A1A',
                        border: '1px solid #FF8000',
                        borderRadius: '4px',
                        padding: '8px',
                        minWidth: '200px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                        pointerEvents: 'none'
                    }}
                >
                    <div style={{
                        fontSize: '10px',
                        fontFamily: 'var(--font-mono)',
                        color: '#FF8000',
                        marginBottom: '6px',
                        fontWeight: 600
                    }}>
                        {symbol} Data Quality
                    </div>

                    <div style={{ fontSize: '9px', color: '#CCCCCC', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                            <span>Current:</span>
                            <span style={{ color: color, fontWeight: 600 }}>{latency}ms</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                            <span>P50 (Median):</span>
                            <span style={{ color: '#00FF9D' }}>{latencyDistribution.p50.toFixed(1)}ms</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                            <span>P95:</span>
                            <span style={{ color: '#FFD700' }}>{latencyDistribution.p95.toFixed(1)}ms</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                            <span>P99:</span>
                            <span style={{ color: '#FF3B30' }}>{latencyDistribution.p99.toFixed(1)}ms</span>
                        </div>
                    </div>

                    {/* Mini histogram */}
                    <div style={{ marginTop: '6px' }}>
                        <div style={{ fontSize: '8px', color: '#888', marginBottom: '3px' }}>
                            Latency Distribution
                        </div>
                        <LatencyHistogram samples={latencyDistribution.samples} />
                    </div>

                    <div style={{
                        fontSize: '8px',
                        color: '#666',
                        marginTop: '6px',
                        paddingTop: '6px',
                        borderTop: '1px solid #333'
                    }}>
                        Status: <span style={{ color: color }}>{feedStatus}</span>
                        {hasGap && (
                            <span style={{ color: '#FFA500', marginLeft: '8px' }}>⚠ Gap Detected</span>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

/**
 * Mini latency histogram component
 */
const LatencyHistogram: React.FC<{ samples: number[] }> = ({ samples }) => {
    if (samples.length === 0) return null;

    // Create 10 buckets
    const bucketCount = 10;
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    const bucketSize = (max - min) / bucketCount;

    const buckets = new Array(bucketCount).fill(0);

    samples.forEach(sample => {
        const bucketIndex = Math.min(
            Math.floor((sample - min) / bucketSize),
            bucketCount - 1
        );
        buckets[bucketIndex]++;
    });

    const maxCount = Math.max(...buckets);

    return (
        <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '1px',
            height: '30px',
            padding: '2px'
        }}>
            {buckets.map((count, index) => {
                const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
                const bucketMin = min + (index * bucketSize);
                const bucketMax = min + ((index + 1) * bucketSize);

                // Color based on latency range
                let barColor = '#00FF9D';
                if (bucketMax > 500) barColor = '#FF3B30';
                else if (bucketMax > 100) barColor = '#FFD700';

                return (
                    <div
                        key={index}
                        style={{
                            flex: 1,
                            height: `${height}%`,
                            backgroundColor: barColor,
                            opacity: 0.7,
                            minHeight: count > 0 ? '2px' : '0px',
                            transition: 'height 0.3s ease'
                        }}
                        title={`${bucketMin.toFixed(0)}-${bucketMax.toFixed(0)}ms: ${count} samples`}
                    />
                );
            })}
        </div>
    );
};

export default DataQualityBadge;
