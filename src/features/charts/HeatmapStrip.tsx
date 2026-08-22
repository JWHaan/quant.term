import React, { useEffect, useRef, useState } from 'react';
import type { HeatmapAggregationResult } from '@/utils/heatmap';

interface HeatmapStripProps {
    heatmap: HeatmapAggregationResult | null;
    visibleRange: { fromTime: number; toTime: number } | null;
    height?: number;
}

const BID_COLOR = '34, 197, 94';
const ASK_COLOR = '239, 68, 68';

const medianGap = (values: number[]): number => {
    if (values.length < 2) return 0;
    const gaps: number[] = [];
    for (let i = 1; i < values.length; i += 1) gaps.push(values[i]! - values[i - 1]!);
    gaps.sort((a, b) => a - b);
    return gaps[Math.floor(gaps.length / 2)] ?? 0;
};

/**
 * Slim depth-liquidity strip synced to the chart's visible time window.
 * Purely presentational: consumes the shared heatmap aggregation plus the
 * chart's visible range so pan/zoom moves the strip in lockstep.
 */
const HeatmapStrip: React.FC<HeatmapStripProps> = ({ heatmap, visibleRange, height = 72 }) => {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [width, setWidth] = useState(0);

    useEffect(() => {
        const wrapper = wrapperRef.current;
        if (!wrapper) return undefined;
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) setWidth(entry.contentRect.width);
        });
        observer.observe(wrapper);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || width <= 0) return;

        const pixelRatio = window.devicePixelRatio || 1;
        if (canvas.width !== Math.floor(width * pixelRatio) || canvas.height !== Math.floor(height * pixelRatio)) {
            canvas.width = Math.floor(width * pixelRatio);
            canvas.height = Math.floor(height * pixelRatio);
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        ctx.clearRect(0, 0, width, height);

        const styles = getComputedStyle(document.documentElement);
        ctx.fillStyle = styles.getPropertyValue('--text-secondary').trim() || '#94a3b8';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';

        const cells = heatmap?.cells ?? [];
        if (!heatmap || heatmap.isEmpty || cells.length === 0) {
            ctx.fillText('depth heatmap warming up', width / 2, height / 2 + 3);
            return;
        }

        const sortedCells = [...cells].sort((a, b) => a.time - b.time);
        const hasRange = Boolean(visibleRange && visibleRange.toTime > visibleRange.fromTime);

        let fromTime: number;
        let toTime: number;
        if (hasRange && visibleRange) {
            fromTime = visibleRange.fromTime;
            toTime = visibleRange.toTime;
        } else {
            fromTime = sortedCells[0]!.time;
            toTime = sortedCells[sortedCells.length - 1]!.time + 1;
        }

        const prices = Array.from(new Set(cells.map((cell) => cell.price))).sort((a, b) => a - b);
        const minPrice = prices[0]!;
        const maxPrice = prices[prices.length - 1]!;
        const priceSpan = Math.max(maxPrice - minPrice, Number.EPSILON);

        // Band thickness approximates the aggregation's price-bin size.
        const priceGap = medianGap(prices);
        const bandHeight = Math.max(2, Math.min(height / 3, (priceGap / priceSpan) * (height - 4)));
        const timeGap = medianGap(Array.from(new Set(cells.map((cell) => cell.time))).sort((a, b) => a - b));
        const bandWidth = hasRange
            ? Math.max(1, Math.min(width / 2, (timeGap / Math.max(toTime - fromTime, 1)) * width))
            : Math.max(2, width / Math.max(sortedCells.length, 1));

        const maxIntensity = Math.max(heatmap.maxBidSize, heatmap.maxAskSize, Number.EPSILON);

        sortedCells.forEach((cell, index) => {
            const x = hasRange
                ? ((cell.time - fromTime) / Math.max(toTime - fromTime, 1)) * width
                : (index / Math.max(sortedCells.length - 1, 1)) * width;
            if (x < -bandWidth || x > width + bandWidth) return;

            const yCenter = height - 2 - ((cell.price - minPrice) / priceSpan) * (height - 4);
            const intensity = Math.max(cell.bidSize, cell.askSize) / maxIntensity;
            const rgb = cell.bidSize >= cell.askSize ? BID_COLOR : ASK_COLOR;

            ctx.fillStyle = `rgba(${rgb}, ${(intensity * 0.55).toFixed(3)})`;
            ctx.fillRect(x - bandWidth / 2, yCenter - bandHeight / 2, bandWidth, bandHeight);
        });
    }, [heatmap, visibleRange, width, height]);

    return (
        <div
            ref={wrapperRef}
            className="chart-heatmap-strip"
            style={{ width: '100%', height }}
            aria-hidden="true"
        >
            <canvas ref={canvasRef} style={{ display: 'block' }} />
        </div>
    );
};

export default HeatmapStrip;
