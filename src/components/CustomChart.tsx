import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import * as d3 from 'd3';
import { useChartDataFeed } from '@/hooks/useChartDataFeed';
import type { OHLCV } from '@/types/common';
import type { HeatmapAggregationResult, HeatmapBinConfig } from '@/utils/heatmap';
import { calculateEMA, calculateMACD, calculateRSI } from '@/utils/indicators';

interface CustomChartProps {
    symbol: string;
    interval: string;
    height?: number;
    showHeatmap?: boolean;
    heatmapConfig?: Partial<HeatmapBinConfig>;
    indicatorToggles?: IndicatorToggles;
}

interface ChartDimensions {
    width: number;
    height: number;
}

interface IndicatorToggles {
    ema9: boolean;
    ema21: boolean;
    macd: boolean;
    rsi: boolean;
}

interface HoverInfo {
    x: number;
    y: number;
    time: number;
    price: number;
    candle?: OHLCV;
    heatmapCell?: HeatmapAggregationResult['cells'][number];
}

const DEFAULT_HEIGHT = 540;
const MARGIN = { top: 24, right: 64, bottom: 30, left: 10 } as const;
const SECTION_GAP = 12;
const VOLUME_RATIO = 0.15;

const formatNumber = (value: number | undefined, digits: number = 2) => {
    if (value === undefined || !Number.isFinite(value)) {
        return '—';
    }
    const resolvedDigits = value < 1 ? Math.max(digits, 4) : digits;
    return value.toLocaleString('en-US', {
        minimumFractionDigits: resolvedDigits,
        maximumFractionDigits: resolvedDigits + 2
    });
};

const CustomChart: React.FC<CustomChartProps> = ({
    symbol,
    interval,
    height = DEFAULT_HEIGHT,
    showHeatmap = true,
    heatmapConfig,
    indicatorToggles: externalIndicatorToggles
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [dimensions, setDimensions] = useState<ChartDimensions>({ width: 0, height });

    // Use external indicator toggles if provided, otherwise use defaults
    const indicatorToggles = externalIndicatorToggles || {
        ema9: true,
        ema21: false,
        macd: false,
        rsi: false
    };

    const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);

    // Zoom state
    const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
    const [transformState, setTransformState] = useState<d3.ZoomTransform>(d3.zoomIdentity);

    // Store draw function in ref to avoid infinite loops
    const drawRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        setDimensions(prev => ({ ...prev, height }));
    }, [height]);

    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver((entries) => {
            entries.forEach(entry => {
                const { width } = entry.contentRect;
                setDimensions(prev => ({ ...prev, width }));
            });
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const feedOptions = useMemo(() => {
        const next: Parameters<typeof useChartDataFeed>[2] = {
            heatmapEnabled: showHeatmap
        };
        if (heatmapConfig) {
            next.heatmapOverrides = heatmapConfig;
        }
        return next;
    }, [heatmapConfig, showHeatmap]);

    const { candles, heatmap } = useChartDataFeed(
        symbol,
        interval,
        feedOptions
    );

    const sortedCandles = useMemo<OHLCV[]>(() => {
        return candles.slice().sort((a, b) => a.time - b.time);
    }, [candles]);

    // Indicators
    // Indicators
    const ema9 = useMemo(() => indicatorToggles.ema9 && sortedCandles.length >= 9 ? calculateEMA(sortedCandles, 9) : [], [indicatorToggles.ema9, sortedCandles]);
    const ema21 = useMemo(() => indicatorToggles.ema21 && sortedCandles.length >= 21 ? calculateEMA(sortedCandles, 21) : [], [indicatorToggles.ema21, sortedCandles]);
    const macdData = useMemo(() => indicatorToggles.macd && sortedCandles.length >= 35 ? calculateMACD(sortedCandles) : [], [indicatorToggles.macd, sortedCandles]);
    const rsiData = useMemo(() => indicatorToggles.rsi && sortedCandles.length >= 15 ? calculateRSI(sortedCandles) : [], [indicatorToggles.rsi, sortedCandles]);

    const effectiveHeatmapConfig = useMemo<Required<Pick<HeatmapBinConfig, 'priceBinSize' | 'timeBinSeconds'>>>(() => ({
        priceBinSize: heatmapConfig?.priceBinSize ?? 0.5,
        timeBinSeconds: heatmapConfig?.timeBinSeconds ?? 10,
    }), [heatmapConfig]);

    // Layout calculations
    const layout = useMemo(() => {
        const { width, height: totalHeight } = dimensions;
        const innerWidth = width - MARGIN.left - MARGIN.right;
        const innerHeight = totalHeight - MARGIN.top - MARGIN.bottom;

        if (innerWidth <= 0 || innerHeight <= 0) return null;

        const indicatorCount = (indicatorToggles.macd ? 1 : 0) + (indicatorToggles.rsi ? 1 : 0);
        const volumeHeight = Math.min(innerHeight * VOLUME_RATIO, 100);
        const indicatorHeight = indicatorCount > 0 ? Math.min(100, (innerHeight - volumeHeight) / (indicatorCount + 2)) : 0;

        let priceHeight = innerHeight - volumeHeight - (indicatorHeight * indicatorCount) - (SECTION_GAP * indicatorCount);

        // Sections
        const priceTop = MARGIN.top;
        const priceBottom = priceTop + priceHeight;

        const volumeTop = priceBottom; // Overlap volume slightly or put it below
        const volumeBottom = volumeTop + volumeHeight;

        let currentTop = volumeBottom + SECTION_GAP;
        const macdTop = indicatorToggles.macd ? currentTop : 0;
        const macdBottom = indicatorToggles.macd ? macdTop + indicatorHeight : 0;
        if (indicatorToggles.macd) currentTop = macdBottom + SECTION_GAP;

        const rsiTop = indicatorToggles.rsi ? currentTop : 0;
        const rsiBottom = indicatorToggles.rsi ? rsiTop + indicatorHeight : 0;

        return {
            width,
            totalHeight,
            innerWidth,
            innerHeight,
            priceTop,
            priceBottom,
            volumeTop,
            volumeBottom,
            macdTop,
            macdBottom,
            rsiTop,
            rsiBottom
        };
    }, [dimensions, indicatorToggles]);

    // Scales
    const scales = useMemo(() => {
        if (!layout || !sortedCandles.length) return null;

        // X Scale is index-based to handle discontinuous time
        const xScaleOriginal = d3.scaleLinear()
            .domain([0, sortedCandles.length])
            .range([MARGIN.left, layout.width - MARGIN.right]);

        // Apply zoom transform
        const xScale = transformState.rescaleX(xScaleOriginal);

        // Determine visible candles
        const [startIndexRaw, endIndexRaw] = xScale.domain().map(Math.round);
        const startIndex = Math.max(0, startIndexRaw ?? 0);
        const endIndex = Math.min(sortedCandles.length - 1, endIndexRaw ?? 0);

        const visibleCandles = sortedCandles.slice(startIndex, endIndex + 1);

        if (!visibleCandles.length) return null;

        // Y Scale (Price)
        const minPrice = d3.min(visibleCandles, d => d.low) ?? 0;
        const maxPrice = d3.max(visibleCandles, d => d.high) ?? 1;
        const pricePadding = (maxPrice - minPrice) * 0.1;

        const priceScale = d3.scaleLinear()
            .domain([minPrice - pricePadding, maxPrice + pricePadding])
            .range([layout.priceBottom, layout.priceTop]);

        // Volume Scale
        const maxVol = d3.max(visibleCandles, d => d.volume) ?? 1;
        const volumeScale = d3.scaleLinear()
            .domain([0, maxVol])
            .range([layout.volumeBottom, layout.volumeTop]);

        // Indicator Scales
        let macdScale = null;
        if (indicatorToggles.macd && macdData.length && visibleCandles.length > 0) {
            const firstTime = visibleCandles[0]?.time ?? 0;
            const lastTime = visibleCandles[visibleCandles.length - 1]?.time ?? 0;
            const visibleMacd = macdData.filter(d => d.time >= firstTime && d.time <= lastTime);
            const extent = d3.extent(visibleMacd.flatMap(d => [d.macd, d.signal, d.histogram])) as [number, number];
            macdScale = d3.scaleLinear()
                .domain([extent[0] ?? -1, extent[1] ?? 1])
                .range([layout.macdBottom, layout.macdTop]);
        }

        let rsiScale = null;
        if (indicatorToggles.rsi) {
            rsiScale = d3.scaleLinear()
                .domain([0, 100])
                .range([layout.rsiBottom, layout.rsiTop]);
        }

        return {
            xScale,
            priceScale,
            volumeScale,
            macdScale,
            rsiScale,
            visibleCandles,
            startIndex,
            endIndex
        };
    }, [layout, sortedCandles, transformState, indicatorToggles, macdData, rsiData]);

    // Zoom Behavior
    useEffect(() => {
        if (!canvasRef.current) return;

        const zoom = d3.zoom<HTMLCanvasElement, unknown>()
            .scaleExtent([0.1, 20])
            .extent([[0, 0], [dimensions.width, dimensions.height]])
            .on('zoom', (event) => {
                transformRef.current = event.transform;
                setTransformState(event.transform);
            });

        const selection = d3.select(canvasRef.current);
        selection.call(zoom);

        // Initial zoom to show last N candles
        if (sortedCandles.length > 0) {
            // Optional: Set initial zoom
        }

        return () => {
            selection.on('.zoom', null);
        };
    }, [dimensions, sortedCandles.length]);

    // Draw Chart
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !layout || !scales) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const pixelRatio = window.devicePixelRatio || 1;

        // Resize canvas if needed
        if (canvas.width !== Math.floor(layout.width * pixelRatio) || canvas.height !== Math.floor(layout.totalHeight * pixelRatio)) {
            canvas.width = Math.floor(layout.width * pixelRatio);
            canvas.height = Math.floor(layout.totalHeight * pixelRatio);
            canvas.style.width = `${layout.width}px`;
            canvas.style.height = `${layout.totalHeight}px`;
            ctx.scale(pixelRatio, pixelRatio);
        } else {
            ctx.clearRect(0, 0, layout.width, layout.totalHeight);
        }

        // Colors
        const styles = getComputedStyle(document.documentElement);
        const bg = styles.getPropertyValue('--chart-bg').trim() || '#0f172a';
        const gridColor = 'rgba(255, 255, 255, 0.05)';
        const upColor = styles.getPropertyValue('--accent-success').trim() || '#22c55e';
        const downColor = styles.getPropertyValue('--accent-danger').trim() || '#ef4444';
        const textColor = styles.getPropertyValue('--text-secondary').trim() || '#94a3b8';

        // Background
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, layout.width, layout.totalHeight);

        const { xScale, priceScale, volumeScale, visibleCandles, startIndex } = scales;
        const candleWidth = Math.max(1, (layout.width - MARGIN.left - MARGIN.right) / (scales.endIndex - scales.startIndex + 1) * 0.7);

        // Grid
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        priceScale.ticks(8).forEach(tick => {
            const y = priceScale(tick);
            ctx.moveTo(MARGIN.left, y);
            ctx.lineTo(layout.width - MARGIN.right, y);
        });
        ctx.stroke();

        // Heatmap
        if (showHeatmap && heatmap && heatmap.cells.length) {
            const timeBinMs = effectiveHeatmapConfig.timeBinSeconds * 1000;
            const priceBinSize = effectiveHeatmapConfig.priceBinSize;

            heatmap.cells.forEach(cell => {
                // Find index for this time
                // This is tricky with discontinuous time. We need to map cell.time to an index.
                // We can use binary search on sortedCandles to find the closest candle index.
                // Or, if we assume alignment, we can try to map.
                // For now, let's just find the candle index that covers this time.

                // Optimization: Pre-calculate time -> index map?
                // Or just binary search.

                // Simple binary search
                let idx = -1;
                let l = 0, r = sortedCandles.length - 1;
                while (l <= r) {
                    const m = (l + r) >> 1;
                    if (sortedCandles[m]!.time * 1000 < cell.time) l = m + 1;
                    else if (sortedCandles[m]!.time * 1000 > cell.time) r = m - 1;
                    else { idx = m; break; }
                }
                // If exact match not found, use closest or floor? 
                // Heatmap cells are bins. We should map the bin start time to an index.
                if (idx === -1) {
                    // Approximate
                    if (r >= 0 && Math.abs(sortedCandles[r]!.time * 1000 - cell.time) < timeBinMs) idx = r;
                    else if (l < sortedCandles.length && Math.abs(sortedCandles[l]!.time * 1000 - cell.time) < timeBinMs) idx = l;
                }

                if (idx >= 0) {
                    const x = xScale(idx);
                    const width = xScale(idx + 1) - x; // Approximate width of one candle unit

                    const y = priceScale(cell.price + priceBinSize);
                    const height = priceScale(cell.price) - y;

                    if (x + width > 0 && x < layout.width && y + height > 0 && y < layout.totalHeight) {
                        const maxBid = heatmap.maxBidSize || 1;
                        const maxAsk = heatmap.maxAskSize || 1;

                        const isBid = cell.bidSize >= cell.askSize;
                        const intensity = isBid ? (cell.bidSize / maxBid) : (cell.askSize / maxAsk);

                        // Use simple opacity for perf
                        ctx.fillStyle = isBid
                            ? `rgba(34, 197, 94, ${intensity * 0.5})`
                            : `rgba(239, 68, 68, ${intensity * 0.5})`;

                        ctx.fillRect(x - candleWidth / 2, y, Math.max(1, width), Math.max(1, height));
                    }
                }
            });
        }

        // Candles
        visibleCandles.forEach((d, i) => {
            const idx = startIndex + i;
            const x = xScale(idx);
            const open = priceScale(d.open);
            const close = priceScale(d.close);
            const high = priceScale(d.high);
            const low = priceScale(d.low);
            const isUp = d.close >= d.open;

            ctx.fillStyle = isUp ? upColor : downColor;
            ctx.strokeStyle = isUp ? upColor : downColor;

            // Wick
            ctx.beginPath();
            ctx.moveTo(x, high);
            ctx.lineTo(x, low);
            ctx.stroke();

            // Body
            const bodyHeight = Math.max(1, Math.abs(open - close));
            const bodyY = Math.min(open, close);
            ctx.fillRect(x - candleWidth / 2, bodyY, candleWidth, bodyHeight);

            // Volume
            const volHeight = layout.volumeBottom - volumeScale(d.volume);
            const volY = layout.volumeBottom - volHeight;
            ctx.fillStyle = isUp ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)';
            ctx.fillRect(x - candleWidth / 2, volY, candleWidth, volHeight);
        });

        // Indicators
        const drawLine = (data: { time: number, value: number }[], color: string, scale: d3.ScaleLinear<number, number>) => {
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            let started = false;

            // We need to map time to index again for indicators
            // This is slow if we do it for every point. 
            // Better: Indicators should be aligned with candles array if possible.
            // Assuming indicators are calculated on the same candles array:

            // If data is aligned with sortedCandles:
            // But calculateEMA returns array of objects with time.
            // We can iterate visibleCandles and find matching indicator value.

            // Optimization: Create a map for indicator values?
            // Or just assume alignment if lengths match? No, EMA starts later.

            // Let's use a map for O(1) lookup
            const map = new Map(data.map(d => [d.time, d.value]));

            visibleCandles.forEach((c, i) => {
                const val = map.get(c.time);
                if (val !== undefined) {
                    const idx = startIndex + i;
                    const x = xScale(idx);
                    const y = scale(val);
                    if (!started) {
                        ctx.moveTo(x, y);
                        started = true;
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
            });
            ctx.stroke();
        };

        if (indicatorToggles.ema9) drawLine(ema9, '#3b82f6', priceScale);
        if (indicatorToggles.ema21) drawLine(ema21, '#8b5cf6', priceScale);

        // MACD Indicator
        if (indicatorToggles.macd && scales.macdScale && macdData.length) {
            const macdMap = new Map(macdData.map(d => [d.time, d]));

            // Draw histogram
            visibleCandles.forEach((c, i) => {
                const data = macdMap.get(c.time);
                if (data && data.histogram !== undefined) {
                    const idx = startIndex + i;
                    const x = xScale(idx);
                    const y = scales.macdScale!(data.histogram);
                    const zeroY = scales.macdScale!(0);
                    const histHeight = zeroY - y;

                    ctx.fillStyle = data.histogram >= 0 ? 'rgba(34, 197, 94, 0.6)' : 'rgba(239, 68, 68, 0.6)';
                    ctx.fillRect(x - candleWidth / 2, y, candleWidth, histHeight);
                }
            });

            // Draw MACD and Signal lines
            drawLine(macdData.map(d => ({ time: d.time, value: d.macd })), '#3b82f6', scales.macdScale);
            drawLine(macdData.map(d => ({ time: d.time, value: d.signal })), '#f59e0b', scales.macdScale);

            // Draw zero line
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            const zeroY = scales.macdScale(0);
            ctx.moveTo(MARGIN.left, zeroY);
            ctx.lineTo(layout.width - MARGIN.right, zeroY);
            ctx.stroke();
        }

        // RSI Indicator
        if (indicatorToggles.rsi && scales.rsiScale && rsiData.length) {
            drawLine(rsiData, '#a855f7', scales.rsiScale);

            // Draw reference lines (30, 50, 70)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 1;
            [30, 50, 70].forEach(level => {
                const y = scales.rsiScale!(level);
                ctx.beginPath();
                ctx.moveTo(MARGIN.left, y);
                ctx.lineTo(layout.width - MARGIN.right, y);
                ctx.stroke();

                // Label
                ctx.fillStyle = textColor;
                ctx.font = '9px monospace';
                ctx.textAlign = 'right';
                ctx.fillText(level.toString(), layout.width - 8, y + 3);
            });
        }

        // Axes
        ctx.fillStyle = textColor;
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        priceScale.ticks(8).forEach(tick => {
            const y = priceScale(tick);
            ctx.fillText(formatNumber(tick), layout.width - 8, y + 3);
        });

        // Time Axis
        ctx.textAlign = 'center';
        const tickCount = Math.floor(layout.width / 100);
        const tickStep = Math.max(1, Math.ceil(visibleCandles.length / tickCount));
        for (let i = 0; i < visibleCandles.length; i += tickStep) {
            const c = visibleCandles[i];
            if (!c) continue;
            const idx = startIndex + i;
            const x = xScale(idx);
            const date = new Date(c.time * 1000);
            const label = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            ctx.fillText(label, x, layout.totalHeight - 10);
        }

    }, [layout, scales, sortedCandles, heatmap, showHeatmap, effectiveHeatmapConfig, indicatorToggles, ema9, ema21, macdData, rsiData]);

    // Update draw ref whenever draw changes
    useEffect(() => {
        drawRef.current = draw;
    }, [draw]);

    // Animation Loop - use ref to avoid infinite loops
    useEffect(() => {
        if (sortedCandles.length === 0) return;

        let frameId: number;
        const render = () => {
            if (drawRef.current) {
                drawRef.current();
            }
            frameId = requestAnimationFrame(render);
        };
        render();
        return () => cancelAnimationFrame(frameId);
    }, [sortedCandles.length]);

    // Interaction (Crosshair)
    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!scales || !layout) return;
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const idx = Math.round(scales.xScale.invert(x));
        const candle = sortedCandles[idx];
        const price = scales.priceScale.invert(y);

        if (candle) {
            setHoverInfo({
                x, y,
                time: candle.time * 1000,
                price,
                candle
            });
        } else {
            setHoverInfo(null);
        }
    }, [scales, layout, sortedCandles]);

    // Show loading state if no data
    if (sortedCandles.length === 0) {
        return (
            <div
                ref={containerRef}
                style={{
                    position: 'relative',
                    width: '100%',
                    height,
                    background: 'var(--chart-bg)',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                <div style={{
                    textAlign: 'center',
                    color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px'
                }}>
                    <div style={{ marginBottom: '8px', fontSize: '14px' }}>Loading chart data...</div>
                    <div style={{ opacity: 0.6 }}>Connecting to {symbol} {interval}</div>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            style={{
                position: 'relative',
                width: '100%',
                height,
                background: 'var(--chart-bg)',
                overflow: 'hidden'
            }}
        >
            <canvas
                ref={canvasRef}
                style={{ display: 'block', cursor: 'crosshair' }}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoverInfo(null)}
            />

            {/* Tooltip / Crosshair Overlay */}
            {hoverInfo && (
                <div
                    style={{
                        position: 'absolute',
                        left: 0, top: 0,
                        width: '100%', height: '100%',
                        pointerEvents: 'none'
                    }}
                >
                    {/* Crosshair Lines */}
                    <div style={{
                        position: 'absolute',
                        left: hoverInfo.x,
                        top: 0,
                        bottom: 0,
                        borderLeft: '1px dashed rgba(255,255,255,0.3)'
                    }} />
                    <div style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: hoverInfo.y,
                        borderTop: '1px dashed rgba(255,255,255,0.3)'
                    }} />

                    {/* Info Box */}
                    <div style={{
                        position: 'absolute',
                        left: 10,
                        top: 10,
                        background: 'rgba(15, 23, 42, 0.9)',
                        border: '1px solid var(--border-color)',
                        padding: '8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        color: 'var(--text-primary)',
                        zIndex: 10
                    }}>
                        <div>O: {formatNumber(hoverInfo.candle?.open)}</div>
                        <div>H: {formatNumber(hoverInfo.candle?.high)}</div>
                        <div>L: {formatNumber(hoverInfo.candle?.low)}</div>
                        <div>C: {formatNumber(hoverInfo.candle?.close)}</div>
                        <div>V: {formatNumber(hoverInfo.candle?.volume)}</div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomChart;
