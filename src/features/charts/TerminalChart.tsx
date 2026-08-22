import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    CandlestickSeries,
    ColorType,
    CrosshairMode,
    HistogramSeries,
    LineSeries,
    LineStyle,
    createChart,
    type IChartApi,
    type IPriceLine,
    type ISeriesApi,
    type LogicalRange,
    type UTCTimestamp,
} from 'lightweight-charts';
import {
    nextChartAction,
    toCandlestickData,
    toLineData,
    toVolumeHistogramData,
} from '@/utils/chartDataMapping';
import { calculateEMA, calculateMACD, calculateRSI } from '@/utils/indicators';
import type { MACDValue } from '@/utils/indicators';
import type { OHLCV } from '@/types/common';
import { resolveChartTheme, type ChartTheme } from '@/features/charts/chartTheme';

export interface IndicatorToggles {
    ema9: boolean;
    ema21: boolean;
    macd: boolean;
    rsi: boolean;
}

interface TerminalChartProps {
    symbol: string;
    interval: string;
    candles: readonly OHLCV[];
    isLoading: boolean;
    error: string | null;
    isConnected: boolean;
    indicatorToggles: IndicatorToggles;
    onVisibleRangeChange?: (range: { fromTime: number; toTime: number } | null) => void;
}

interface IndicatorMeta {
    len: number;
    lastTime: number;
}

type IndicatorId = 'ema9' | 'ema21' | 'macdHistogram' | 'macdLine' | 'macdSignal' | 'rsi';

const RSI_PANE_HEIGHT_PX = 90;
const MACD_PANE_HEIGHT_PX = 110;

const formatNumber = (value: number | undefined, digits: number = 2) => {
    if (value === undefined || !Number.isFinite(value)) return '—';
    const resolvedDigits = value < 1 ? Math.max(digits, 4) : digits;
    return value.toLocaleString('en-US', {
        minimumFractionDigits: resolvedDigits,
        maximumFractionDigits: resolvedDigits + 2,
    });
};

const TerminalChart: React.FC<TerminalChartProps> = ({
    symbol,
    interval,
    candles,
    isLoading,
    error,
    isConnected,
    indicatorToggles,
    onVisibleRangeChange,
}) => {
    const hostRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const indicatorSeriesRef = useRef(new Map<IndicatorId, ISeriesApi<'Line' | 'Histogram'>>());
    const rsiGuideLinesRef = useRef<IPriceLine[]>([]);
    const candlesRef = useRef<readonly OHLCV[]>(candles);
    const prevSeriesRef = useRef<{ key: string; candles: readonly OHLCV[] }>({ key: '', candles: [] });
    const indicatorMetaRef = useRef<Record<string, IndicatorMeta>>({});
    const onRangeChangeRef = useRef(onVisibleRangeChange);

    const readTheme = useCallback(
        () =>
            resolveChartTheme((name) =>
                getComputedStyle(document.documentElement).getPropertyValue(name),
            ),
        [],
    );

    // Re-resolved whenever ThemeProvider flips `data-theme`.
    const [theme, setTheme] = useState<ChartTheme>(readTheme);
    useEffect(() => {
        const observer = new MutationObserver(() => setTheme(readTheme()));
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme'],
        });
        return () => observer.disconnect();
    }, [readTheme]);

    useEffect(() => {
        candlesRef.current = candles;
    }, [candles]);

    const seriesKey = `${symbol}:${interval}`;
    const sortedCandles = useMemo<OHLCV[]>(() => [...candles].sort((a, b) => a.time - b.time), [candles]);

    const ema9Values = useMemo(
        () => (indicatorToggles.ema9 && sortedCandles.length >= 9 ? calculateEMA(sortedCandles, 9) : []),
        [indicatorToggles.ema9, sortedCandles],
    );
    const ema21Values = useMemo(
        () => (indicatorToggles.ema21 && sortedCandles.length >= 21 ? calculateEMA(sortedCandles, 21) : []),
        [indicatorToggles.ema21, sortedCandles],
    );
    const macdValues = useMemo(
        () => (indicatorToggles.macd && sortedCandles.length >= 35 ? calculateMACD(sortedCandles) : [] as MACDValue[]),
        [indicatorToggles.macd, sortedCandles],
    );
    const rsiValues = useMemo(
        () => (indicatorToggles.rsi && sortedCandles.length >= 15 ? calculateRSI(sortedCandles) : []),
        [indicatorToggles.rsi, sortedCandles],
    );

    const baseChartOptions = useMemo(
        () => ({
            autoSize: true,
            layout: {
                background: { type: ColorType.Solid, color: theme.background },
                textColor: theme.textColor,
            },
            grid: {
                vertLines: { color: theme.gridColor },
                horzLines: { color: theme.gridColor },
            },
            crosshair: {
                mode: CrosshairMode.Normal,
                vertLine: { color: theme.crosshairColor, labelBackgroundColor: theme.crosshairColor },
                horzLine: { color: theme.crosshairColor, labelBackgroundColor: theme.crosshairColor },
            },
            rightPriceScale: { borderColor: theme.borderColor },
            timeScale: {
                borderColor: theme.borderColor,
                timeVisible: true,
                secondsVisible: false,
            },
        }),
        [theme],
    );

    const applyThemeToSeries = useCallback((chartTheme: ChartTheme) => {
        candleSeriesRef.current?.applyOptions({
            upColor: chartTheme.upColor,
            downColor: chartTheme.downColor,
            borderUpColor: chartTheme.upColor,
            borderDownColor: chartTheme.downColor,
            wickUpColor: chartTheme.upColor,
            wickDownColor: chartTheme.downColor,
        });
        const ema9 = indicatorSeriesRef.current.get('ema9');
        const ema21 = indicatorSeriesRef.current.get('ema21');
        const macdLine = indicatorSeriesRef.current.get('macdLine');
        const macdSignal = indicatorSeriesRef.current.get('macdSignal');
        const rsi = indicatorSeriesRef.current.get('rsi');
        ema9?.applyOptions({ color: chartTheme.ema9 });
        ema21?.applyOptions({ color: chartTheme.ema21 });
        macdLine?.applyOptions({ color: chartTheme.macd });
        macdSignal?.applyOptions({ color: chartTheme.signal });
        rsi?.applyOptions({ color: chartTheme.rsi });
    }, []);

    // Chart lifecycle: created once, re-themed in place on theme changes.
    useEffect(() => {
        const host = hostRef.current;
        if (!host) return undefined;

        const indicatorSeries = indicatorSeriesRef.current;
        const chart = createChart(host);
        chartRef.current = chart;

        const candleSeries = chart.addSeries(CandlestickSeries, {}, 0);
        const volumeSeries = chart.addSeries(
            HistogramSeries,
            {
                priceScaleId: 'volume',
                priceFormat: { type: 'volume' },
                lastValueVisible: false,
                priceLineVisible: false,
            },
            0,
        );
        volumeSeries.priceScale().applyOptions({
            scaleMargins: { top: 0.8, bottom: 0 },
        });

        candleSeriesRef.current = candleSeries;
        volumeSeriesRef.current = volumeSeries;

        const handleRangeChange = (range: LogicalRange | null) => {
            const current = candlesRef.current;
            const emit = onRangeChangeRef.current;
            if (!emit) return;
            if (!range || current.length === 0) {
                emit(null);
                return;
            }
            const fromIndex = Math.max(0, Math.min(current.length - 1, Math.floor(range.from)));
            const toIndex = Math.max(0, Math.min(current.length - 1, Math.ceil(range.to)));
            emit({ fromTime: current[fromIndex]!.time, toTime: current[toIndex]!.time });
        };
        chart.timeScale().subscribeVisibleLogicalRangeChange(handleRangeChange);

        return () => {
            chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleRangeChange);
            rsiGuideLinesRef.current = [];
            indicatorSeries.clear();
            candleSeriesRef.current = null;
            volumeSeriesRef.current = null;
            chartRef.current = null;
            prevSeriesRef.current = { key: '', candles: [] };
            indicatorMetaRef.current = {};
            chart.remove();
        };
    }, []);

    // Theme changes apply in place to the chart and every live series.
    useEffect(() => {
        const chart = chartRef.current;
        if (!chart) return;
        chart.applyOptions(baseChartOptions);
        applyThemeToSeries(theme);
        const volumeSeries = volumeSeriesRef.current;
        if (volumeSeries) {
            const previous = prevSeriesRef.current.candles;
            if (previous.length > 0) {
                volumeSeries.setData(
                    toVolumeHistogramData(previous, { up: theme.upColor, down: theme.downColor }),
                );
            }
        }
    }, [baseChartOptions, applyThemeToSeries, theme]);

    // Candle data: incremental update vs full reload.
    useEffect(() => {
        const candleSeries = candleSeriesRef.current;
        const volumeSeries = volumeSeriesRef.current;
        if (!candleSeries || !volumeSeries || sortedCandles.length === 0) return;

        const previous = prevSeriesRef.current;
        const isSameSeries = previous.key === seriesKey;
        const action = isSameSeries ? nextChartAction(previous.candles, sortedCandles) : { type: 'reload' as const };

        if (action.type === 'reload') {
            candleSeries.setData(toCandlestickData(sortedCandles));
            volumeSeries.setData(
                toVolumeHistogramData(sortedCandles, { up: theme.upColor, down: theme.downColor }),
            );
            if (!isSameSeries) {
                chartRef.current?.timeScale().fitContent();
            }
        } else {
            candleSeries.update(action.candle);
            volumeSeries.update(action.volume);
        }

        prevSeriesRef.current = { key: seriesKey, candles: sortedCandles };
    }, [seriesKey, sortedCandles, theme]);

    // Indicator series lifecycle: lazy pane creation/removal on toggle.
    useEffect(() => {
        const chart = chartRef.current;
        if (!chart) return;

        const ensureLine = (id: IndicatorId, color: string, paneIndex?: number) => {
            const existing = indicatorSeriesRef.current.get(id);
            if (existing) return existing;
            const series = chart.addSeries(
                LineSeries,
                {
                    color,
                    lineWidth: 1,
                    lastValueVisible: false,
                    priceLineVisible: false,
                    crosshairMarkerVisible: false,
                },
                paneIndex ?? chart.panes().length,
            );
            indicatorSeriesRef.current.set(id, series);
            return series;
        };

        if (indicatorToggles.rsi) {
            const rsi = ensureLine('rsi', theme.rsi);
            if (rsiGuideLinesRef.current.length === 0) {
                rsiGuideLinesRef.current = [
                    rsi.createPriceLine({ price: 70, color: theme.crosshairColor, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false }),
                    rsi.createPriceLine({ price: 30, color: theme.crosshairColor, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false }),
                ];
            }
            if (chart.panes().length > 1) {
                chart.panes()[chart.panes().length - 1]?.setHeight(RSI_PANE_HEIGHT_PX);
            }
        } else {
            const rsi = indicatorSeriesRef.current.get('rsi');
            if (rsi) {
                chart.removeSeries(rsi);
                indicatorSeriesRef.current.delete('rsi');
                rsiGuideLinesRef.current = [];
            }
        }

        if (indicatorToggles.macd) {
            const hadMacd = indicatorSeriesRef.current.has('macdHistogram');
            if (!hadMacd) {
                const paneIndex = chart.panes().length;
                const histogram = chart.addSeries(HistogramSeries, { lastValueVisible: false, priceLineVisible: false }, paneIndex);
                const macdLine = chart.addSeries(
                    LineSeries,
                    { color: theme.macd, lineWidth: 1, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false },
                    paneIndex,
                );
                const signalLine = chart.addSeries(
                    LineSeries,
                    { color: theme.signal, lineWidth: 1, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false },
                    paneIndex,
                );
                indicatorSeriesRef.current.set('macdHistogram', histogram);
                indicatorSeriesRef.current.set('macdLine', macdLine);
                indicatorSeriesRef.current.set('macdSignal', signalLine);
                chart.panes()[paneIndex]?.setHeight(MACD_PANE_HEIGHT_PX);
            }
        } else {
            (['macdHistogram', 'macdLine', 'macdSignal'] as const).forEach((id) => {
                const series = indicatorSeriesRef.current.get(id);
                if (series) {
                    chart.removeSeries(series);
                    indicatorSeriesRef.current.delete(id);
                }
            });
        }

        if (indicatorToggles.ema9) ensureLine('ema9', theme.ema9, 0);
        else {
            const ema9 = indicatorSeriesRef.current.get('ema9');
            if (ema9) {
                chart.removeSeries(ema9);
                indicatorSeriesRef.current.delete('ema9');
            }
        }

        if (indicatorToggles.ema21) ensureLine('ema21', theme.ema21, 0);
        else {
            const ema21 = indicatorSeriesRef.current.get('ema21');
            if (ema21) {
                chart.removeSeries(ema21);
                indicatorSeriesRef.current.delete('ema21');
            }
        }
    }, [indicatorToggles.ema9, indicatorToggles.ema21, indicatorToggles.macd, indicatorToggles.rsi, theme]);

    // Push computed indicator values into their series.
    useEffect(() => {
        const pushLine = (id: IndicatorId, values: { time: number; value: number }[]) => {
            const series = indicatorSeriesRef.current.get(id) as ISeriesApi<'Line'> | undefined;
            if (!series) return;
            const meta = indicatorMetaRef.current[id] ?? { len: 0, lastTime: 0 };
            const last = values[values.length - 1];
            if (
                values.length > 0 &&
                meta.len > 0 &&
                (values.length === meta.len || values.length === meta.len + 1) &&
                last!.time === meta.lastTime
            ) {
                series.update({ time: Math.floor(last!.time) as UTCTimestamp, value: last!.value });
            } else {
                series.setData(toLineData(values));
            }
            indicatorMetaRef.current[id] = {
                len: values.length,
                lastTime: last?.time ?? 0,
            };
        };

        const pushMacd = (values: MACDValue[]) => {
            const histogram = indicatorSeriesRef.current.get('macdHistogram') as ISeriesApi<'Histogram'> | undefined;
            const macdLine = indicatorSeriesRef.current.get('macdLine') as ISeriesApi<'Line'> | undefined;
            const signalLine = indicatorSeriesRef.current.get('macdSignal') as ISeriesApi<'Line'> | undefined;
            if (!histogram || !macdLine || !signalLine) return;

            const meta = indicatorMetaRef.current.macd ?? { len: 0, lastTime: 0 };
            const last = values[values.length - 1];
            const trailingOnly =
                values.length > 0 &&
                meta.len > 0 &&
                (values.length === meta.len || values.length === meta.len + 1) &&
                last!.time === meta.lastTime;

            if (trailingOnly && last) {
                const time = Math.floor(last.time) as UTCTimestamp;
                histogram.update({
                    time,
                    value: last.histogram,
                    color: last.histogram >= 0 ? `${theme.upColor}99` : `${theme.downColor}99`,
                });
                macdLine.update({ time, value: last.macd });
                signalLine.update({ time, value: last.signal });
            } else {
                histogram.setData(
                    values.map((row) => ({
                        time: Math.floor(row.time) as UTCTimestamp,
                        value: row.histogram,
                        color: row.histogram >= 0 ? `${theme.upColor}99` : `${theme.downColor}99`,
                    })),
                );
                macdLine.setData(toLineData(values.map((row) => ({ time: row.time, value: row.macd }))));
                signalLine.setData(toLineData(values.map((row) => ({ time: row.time, value: row.signal }))));
            }
            indicatorMetaRef.current.macd = { len: values.length, lastTime: last?.time ?? 0 };
        };

        pushLine('ema9', ema9Values);
        pushLine('ema21', ema21Values);
        pushMacd(macdValues);
        pushLine('rsi', rsiValues);
    }, [ema9Values, ema21Values, macdValues, rsiValues, theme]);

    const latest = sortedCandles[sortedCandles.length - 1];
    const showOverlay = sortedCandles.length === 0;

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <div
                ref={hostRef}
                role="img"
                aria-label={`${symbol} ${interval} candlestick chart with ${sortedCandles.length} candles`}
                tabIndex={0}
                style={{ width: '100%', height: '100%' }}
            />

            {showOverlay && (
                <div
                    aria-live="polite"
                    style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        pointerEvents: 'none',
                        color: 'var(--text-secondary)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12,
                        textAlign: 'center',
                        background: theme.background,
                    }}
                >
                    <div style={{ fontSize: 14 }}>
                        {error ? 'Chart data unavailable' : isLoading ? 'Loading chart data…' : 'Awaiting live candles…'}
                    </div>
                    <div style={{ opacity: 0.7 }}>{error ?? `Connecting to Binance Spot · ${symbol} · ${interval}`}</div>
                </div>
            )}

            <div className={`chart-feed-state ${isConnected ? 'chart-feed-state--live' : ''}`} role="status">
                <span /> {isConnected ? 'LIVE' : 'RECONNECTING'}
            </div>

            <p className="sr-only">
                Latest close {formatNumber(latest?.close)}. High {formatNumber(latest?.high)}. Low{' '}
                {formatNumber(latest?.low)}. Volume {formatNumber(latest?.volume)}.
            </p>
        </div>
    );
};

export default TerminalChart;
