import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CandlestickSeries, HistogramSeries, LineSeries, IChartApi, ISeriesApi, Time, CandlestickData, HistogramData, LineData, IPriceLine } from 'lightweight-charts';
import { useBinanceWebSocket } from '@/hooks/useBinanceWebSocket';
import { calculateVWAP, calculateEMA, calculateSMA, calculateBollingerBands } from '@/utils/indicators';
import { Eraser, MousePointer2 } from 'lucide-react';

const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'];

interface ChartContainerProps {
    symbol?: string;
}

interface FormattedData {
    time: Time;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

const ChartContainer: React.FC<ChartContainerProps> = ({ symbol = 'btcusdt' }) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const [interval, setInterval] = useState<string>('1m');
    const { candle, isConnected } = useBinanceWebSocket(symbol, interval);

    const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
    const vwapSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const ema9SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const ema21SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const sma50SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const sma200SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const bbUpperRef = useRef<ISeriesApi<"Line"> | null>(null);
    const bbMiddleRef = useRef<ISeriesApi<"Line"> | null>(null);
    const bbLowerRef = useRef<ISeriesApi<"Line"> | null>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const drawingRef = useRef<IPriceLine[]>([]); // Store lines

    const [showVWAP, setShowVWAP] = useState(true);
    const [showEMA9, setShowEMA9] = useState(false);
    const [showEMA21, setShowEMA21] = useState(false);
    const [showSMA50, setShowSMA50] = useState(false);
    const [showSMA200, setShowSMA200] = useState(false);
    const [showBB, setShowBB] = useState(false);

    // Fetch Historical Data
    const fetchHistoricalData = async (sym: string, int: string): Promise<FormattedData[]> => {
        try {
            const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${sym.toUpperCase()}&interval=${int}&limit=500`);
            const rawData = await response.json();

            const formattedData: FormattedData[] = rawData.map((d: any) => ({
                time: d[0] / 1000 as Time,
                open: parseFloat(d[1]),
                high: parseFloat(d[2]),
                low: parseFloat(d[3]),
                close: parseFloat(d[4]),
                volume: parseFloat(d[5])
            }));

            return formattedData;
        } catch (error) {
            console.error("Failed to fetch historical data:", error);
            return [];
        }
    };

    // Initialize Chart & Load Data
    useEffect(() => {
        if (!chartContainerRef.current) return;

        chartContainerRef.current.innerHTML = '';

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#000000' },
                textColor: '#FF8000',
                fontFamily: 'JetBrains Mono, monospace',
            },
            grid: {
                vertLines: { color: '#1A1A1A', style: 1 },
                horzLines: { color: '#1A1A1A', style: 1 },
            },
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
            timeScale: {
                borderColor: '#FF8000',
                timeVisible: true,
                secondsVisible: false,
            },
            rightPriceScale: {
                borderColor: '#FF8000',
            },
            crosshair: {
                mode: 1,
                vertLine: {
                    color: '#FF8000',
                    width: 1,
                    style: 3, // Dashed
                    labelBackgroundColor: '#FF8000',
                },
                horzLine: {
                    color: '#FF8000',
                    width: 1,
                    style: 3, // Dashed
                    labelBackgroundColor: '#FF8000',
                },
            }
        });
        chartRef.current = chart;

        const candlestickSeries = chart.addSeries(CandlestickSeries, {
            // Up: Green body, Orange border (Hollow)
            // Down: Red body, Red border (Filled)
            upColor: '#00FF9D',
            downColor: '#FF3B30',
            borderUpColor: '#FFB84D',
            borderDownColor: '#FF3B30',
            wickUpColor: '#FFB84D',
            wickDownColor: '#FF3B30',
        });
        candlestickSeriesRef.current = candlestickSeries;

        const volumeSeries = chart.addSeries(HistogramSeries, {
            color: '#4D4D4D',
            priceFormat: { type: 'volume' },
            priceScaleId: '',
        });
        volumeSeriesRef.current = volumeSeries;

        volumeSeries.priceScale().applyOptions({
            scaleMargins: { top: 0.8, bottom: 0 },
        });

        const vwapSeries = chart.addSeries(LineSeries, {
            color: '#FFD700', // Gold
            lineWidth: 2,
            crosshairMarkerVisible: false,
            lineStyle: 0, // Solid
            title: 'VWAP'
        });
        vwapSeriesRef.current = vwapSeries;

        // EMA 9
        const ema9Series = chart.addSeries(LineSeries, {
            color: '#00D084', // Bloomberg Green
            lineWidth: 1,
            crosshairMarkerVisible: false,
            visible: false,
            title: 'EMA 9'
        });
        ema9SeriesRef.current = ema9Series;

        // EMA 21
        const ema21Series = chart.addSeries(LineSeries, {
            color: '#FFB84D', // Light Amber
            lineWidth: 1,
            crosshairMarkerVisible: false,
            visible: false,
            title: 'EMA 21'
        });
        ema21SeriesRef.current = ema21Series;

        // SMA 50
        const sma50Series = chart.addSeries(LineSeries, {
            color: '#FF8000', // Bloomberg Orange
            lineWidth: 1,
            crosshairMarkerVisible: false,
            visible: false,
            title: 'SMA 50'
        });
        sma50SeriesRef.current = sma50Series;

        // SMA 200
        const sma200Series = chart.addSeries(LineSeries, {
            color: '#ff3b30', // Red
            lineWidth: 2,
            crosshairMarkerVisible: false,
            visible: false,
            title: 'SMA 200'
        });
        sma200SeriesRef.current = sma200Series;

        // Bollinger Bands
        const bbUpper = chart.addSeries(LineSeries, {
            color: '#ff3b30', // Red
            lineWidth: 1,
            lineStyle: 2, // Dashed
            crosshairMarkerVisible: false,
            visible: false,
            title: 'BB Upper'
        });
        bbUpperRef.current = bbUpper;

        const bbMiddle = chart.addSeries(LineSeries, {
            color: '#ffffff', // White
            lineWidth: 1,
            lineStyle: 1, // Dotted
            crosshairMarkerVisible: false,
            visible: false,
            title: 'BB Middle'
        });
        bbMiddleRef.current = bbMiddle;

        const bbLower = chart.addSeries(LineSeries, {
            color: '#00ff9d', // Green
            lineWidth: 1,
            lineStyle: 2, // Dashed
            crosshairMarkerVisible: false,
            visible: false,
            title: 'BB Lower'
        });
        bbLowerRef.current = bbLower;

        // Load Data
        fetchHistoricalData(symbol, interval).then(data => {
            // Separate data for series
            const candleData: CandlestickData[] = data.map(d => ({
                time: d.time,
                open: d.open,
                high: d.high,
                low: d.low,
                close: d.close
            }));
            candlestickSeries.setData(candleData);

            const volumeData: HistogramData[] = data.map(d => ({
                time: d.time,
                value: d.volume,
                color: d.close > d.open ? 'rgba(0, 255, 157, 0.3)' : 'rgba(255, 59, 48, 0.3)',
            }));
            volumeSeries.setData(volumeData);

            const ohlcvData = data.map(d => ({
                ...d,
                time: d.time as unknown as number
            }));

            const vwapData = calculateVWAP(ohlcvData);
            vwapSeries.setData(vwapData as LineData[]);

            // Calculate and set MA data
            const ema9Data = calculateEMA(ohlcvData, 9);
            ema9Series.setData(ema9Data as LineData[]);

            const ema21Data = calculateEMA(ohlcvData, 21);
            ema21Series.setData(ema21Data as LineData[]);

            const sma50Data = calculateSMA(ohlcvData, 50);
            sma50Series.setData(sma50Data as LineData[]);

            const sma200Data = calculateSMA(ohlcvData, 200);
            sma200Series.setData(sma200Data as LineData[]);

            // Calculate and set BB data
            const bbData = calculateBollingerBands(ohlcvData, 20, 2);
            bbUpper.setData(bbData.map(d => ({ time: d.time as Time, value: d.upper })));
            bbMiddle.setData(bbData.map(d => ({ time: d.time as Time, value: d.middle })));
            bbLower.setData(bbData.map(d => ({ time: d.time as Time, value: d.lower })));
        });

        // Drawing Tool: Shift+Click to add Horizontal Line
        chart.subscribeClick((param) => {
            if (!param.point || !param.time || !window.event || !(window.event as MouseEvent).shiftKey) return;

            const price = candlestickSeries.coordinateToPrice(param.point.y);
            if (!price) return;

            const priceLine = candlestickSeries.createPriceLine({
                price: price,
                color: '#ffffff',
                lineWidth: 1,
                lineStyle: 2, // Dashed
                axisLabelVisible: true,
                title: 'S/R',
            });

            drawingRef.current.push(priceLine);
        });

        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({
                    width: chartContainerRef.current.clientWidth,
                    height: chartContainerRef.current.clientHeight
                });
            }
        };

        const resizeObserver = new ResizeObserver(() => handleResize());
        resizeObserver.observe(chartContainerRef.current);

        return () => {
            resizeObserver.disconnect();
            chart.remove();
            chartRef.current = null;
            drawingRef.current = [];
        };
    }, [symbol, interval]);

    // Update Chart with Real-Time Data
    useEffect(() => {
        if (candle && candlestickSeriesRef.current && volumeSeriesRef.current && vwapSeriesRef.current) {
            const time = candle.time as Time;
            candlestickSeriesRef.current.update({
                time: time,
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close
            });

            volumeSeriesRef.current.update({
                time: time,
                value: candle.volume,
                color: candle.close > candle.open ? 'rgba(0, 255, 157, 0.3)' : 'rgba(255, 59, 48, 0.3)',
            });

            // Note: VWAP and other indicators would need a different approach
            // since we removed the chartData state for optimization
        }
    }, [candle]);

    // Toggle Indicator visibility
    useEffect(() => {
        if (vwapSeriesRef.current) {
            vwapSeriesRef.current.applyOptions({ visible: showVWAP });
        }
    }, [showVWAP]);

    useEffect(() => {
        if (ema9SeriesRef.current) {
            ema9SeriesRef.current.applyOptions({ visible: showEMA9 });
        }
    }, [showEMA9]);

    useEffect(() => {
        if (ema21SeriesRef.current) {
            ema21SeriesRef.current.applyOptions({ visible: showEMA21 });
        }
    }, [showEMA21]);

    useEffect(() => {
        if (sma50SeriesRef.current) {
            sma50SeriesRef.current.applyOptions({ visible: showSMA50 });
        }
    }, [showSMA50]);

    useEffect(() => {
        if (sma200SeriesRef.current) {
            sma200SeriesRef.current.applyOptions({ visible: showSMA200 });
        }
    }, [showSMA200]);

    useEffect(() => {
        if (bbUpperRef.current && bbMiddleRef.current && bbLowerRef.current) {
            bbUpperRef.current.applyOptions({ visible: showBB });
            bbMiddleRef.current.applyOptions({ visible: showBB });
            bbLowerRef.current.applyOptions({ visible: showBB });
        }
    }, [showBB]);

    // Clear Drawings
    const clearDrawings = () => {
        if (candlestickSeriesRef.current) {
            drawingRef.current.forEach(line => {
                candlestickSeriesRef.current?.removePriceLine(line);
            });
            drawingRef.current = [];
        }
    };

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />

            {/* Toolbar */}
            <div style={{
                position: 'absolute',
                top: 10,
                left: 10,
                zIndex: 20,
                display: 'flex',
                gap: '8px',
                alignItems: 'center'
            }}>
                {/* Status */}
                <div style={{
                    padding: '4px 8px',
                    backgroundColor: isConnected ? 'rgba(0, 255, 157, 0.1)' : 'rgba(255, 59, 48, 0.1)',
                    border: `1px solid ${isConnected ? 'var(--accent-primary)' : 'var(--accent-danger)'}`,
                    borderRadius: '4px',
                    fontSize: '10px',
                    color: isConnected ? 'var(--accent-primary)' : 'var(--accent-danger)',
                    fontFamily: 'var(--font-mono)'
                }}>
                    {isConnected ? '● LIVE' : '○ CONNECTING'}
                </div>

                {/* Timeframe Selector */}
                <div style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', padding: '2px' }}>
                    {INTERVALS.map(tf => (
                        <button
                            key={tf}
                            onClick={() => setInterval(tf)}
                            style={{
                                padding: '2px 6px',
                                background: interval === tf ? 'var(--accent-primary)' : 'transparent',
                                border: 'none',
                                borderRadius: '2px',
                                fontSize: '10px',
                                color: interval === tf ? '#000' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                fontFamily: 'var(--font-mono)'
                            }}
                        >
                            {tf}
                        </button>
                    ))}
                </div>

                {/* Indicators */}
                <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                        onClick={() => setShowVWAP(!showVWAP)}
                        style={{
                            padding: '4px 6px',
                            backgroundColor: showVWAP ? 'var(--accent-warning)' : 'rgba(255, 255, 255, 0.1)',
                            border: 'none',
                            borderRadius: '2px',
                            fontSize: '9px',
                            color: showVWAP ? '#000' : 'var(--text-secondary)',
                            fontFamily: 'var(--font-mono)',
                            cursor: 'pointer'
                        }}
                    >
                        VWAP
                    </button>
                    <button
                        onClick={() => setShowEMA9(!showEMA9)}
                        style={{
                            padding: '4px 6px',
                            backgroundColor: showEMA9 ? '#00ff9d' : 'rgba(255, 255, 255, 0.1)',
                            border: 'none',
                            borderRadius: '2px',
                            fontSize: '9px',
                            color: showEMA9 ? '#000' : 'var(--text-secondary)',
                            fontFamily: 'var(--font-mono)',
                            cursor: 'pointer'
                        }}
                    >
                        EMA9
                    </button>
                    <button
                        onClick={() => setShowEMA21(!showEMA21)}
                        style={{
                            padding: '4px 6px',
                            backgroundColor: showEMA21 ? '#ffff00' : 'rgba(255, 255, 255, 0.1)',
                            border: 'none',
                            borderRadius: '2px',
                            fontSize: '9px',
                            color: showEMA21 ? '#000' : 'var(--text-secondary)',
                            fontFamily: 'var(--font-mono)',
                            cursor: 'pointer'
                        }}
                    >
                        EMA21
                    </button>
                    <button
                        onClick={() => setShowSMA50(!showSMA50)}
                        style={{
                            padding: '4px 6px',
                            backgroundColor: showSMA50 ? '#ff9500' : 'rgba(255, 255, 255, 0.1)',
                            border: 'none',
                            borderRadius: '2px',
                            fontSize: '9px',
                            color: showSMA50 ? '#000' : 'var(--text-secondary)',
                            fontFamily: 'var(--font-mono)',
                            cursor: 'pointer'
                        }}
                    >
                        SMA50
                    </button>
                    <button
                        onClick={() => setShowSMA200(!showSMA200)}
                        style={{
                            padding: '4px 6px',
                            backgroundColor: showSMA200 ? '#ff3b30' : 'rgba(255, 255, 255, 0.1)',
                            border: 'none',
                            borderRadius: '2px',
                            fontSize: '9px',
                            color: showSMA200 ? '#fff' : 'var(--text-secondary)',
                            fontFamily: 'var(--font-mono)',
                            cursor: 'pointer'
                        }}
                    >
                        SMA200
                    </button>
                    <button
                        onClick={() => setShowBB(!showBB)}
                        style={{
                            padding: '4px 6px',
                            backgroundColor: showBB ? '#ffffff' : 'rgba(255, 255, 255, 0.1)',
                            border: 'none',
                            borderRadius: '2px',
                            fontSize: '9px',
                            color: showBB ? '#000' : 'var(--text-secondary)',
                            fontFamily: 'var(--font-mono)',
                            cursor: 'pointer'
                        }}
                    >
                        BB
                    </button>
                </div>

                {/* Tools */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MousePointer2 size={10} />
                        <span>Shift+Click to Draw</span>
                    </div>
                    <button
                        onClick={clearDrawings}
                        title="Clear Drawings"
                        style={{
                            padding: '4px',
                            background: 'rgba(255, 59, 48, 0.1)',
                            border: '1px solid var(--accent-danger)',
                            borderRadius: '4px',
                            color: 'var(--accent-danger)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                    >
                        <Eraser size={12} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChartContainer;
