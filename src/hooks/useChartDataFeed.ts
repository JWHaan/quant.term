import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchKlinesSnapshot } from '@/integrations/binance/klines';
import { useBinanceWebSocket } from '@/hooks/useBinanceWebSocket';
import { useDepthStream } from '@/hooks/useDepthStream';
import { useChartDataStore } from '@/stores/chartDataStore';
import { orderBookToSnapshot, useOrderBookHistoryStore } from '@/stores/orderBookHistoryStore';
import type { OHLCV } from '@/types/common';
import type { HeatmapAggregationResult, HeatmapBinConfig } from '@/utils/heatmap';

const EMPTY_CANDLES: OHLCV[] = [];
const MAX_BINANCE_KLINES = 1_000;
const HISTORICAL_FETCH_TIMEOUT_MS = 8_000;

interface UseChartDataFeedOptions {
    heatmapEnabled?: boolean;
    orderBookSnapshotSymbol?: string;
    fetchLimit?: number;
    heatmapOverrides?: Partial<HeatmapBinConfig>;
}

interface UseChartDataFeedResult {
    isConnected: boolean;
    lastUpdate: number;
    reconnectCount: number;
    latestCandle: OHLCV | null;
    candles: OHLCV[];
    isLoading: boolean;
    error: string | null;
    heatmap: HeatmapAggregationResult | null;
}

const normalizeFetchLimit = (requested: number | undefined): number => {
    if (requested === undefined || !Number.isFinite(requested)) return MAX_BINANCE_KLINES;
    return Math.min(MAX_BINANCE_KLINES, Math.max(1, Math.floor(requested)));
};

export const useChartDataFeed = (
    symbol: string,
    interval: string,
    options: UseChartDataFeedOptions = {},
): UseChartDataFeedResult => {
    const normalizedSymbol = useMemo(() => symbol.toUpperCase(), [symbol]);
    const seriesKey = `${normalizedSymbol}:${interval}`;
    const fetchLimit = normalizeFetchLimit(options.fetchLimit);

    const setHeatmapCapture = useOrderBookHistoryStore((state) => state.addSnapshot);
    const snapshots = useOrderBookHistoryStore((state) => state.snapshots);
    const [errorState, setErrorState] = useState<{ key: string; message: string | null }>({
        key: '',
        message: null,
    });
    const requestIdRef = useRef(0);
    const latestLiveCandleRef = useRef<{ key: string; candle: OHLCV } | null>(null);

    const setSeriesLoading = useChartDataStore((state) => state.setSeriesLoading);
    const setHistoricalCandles = useChartDataStore((state) => state.setHistoricalCandles);
    const upsertCandle = useChartDataStore((state) => state.upsertCandle);
    const buildHeatmap = useChartDataStore((state) => state.buildHeatmap);
    const setHeatmapConfig = useChartDataStore((state) => state.setHeatmapConfig);

    const { candle, isConnected, lastUpdate, reconnectCount } = useBinanceWebSocket(
        normalizedSymbol,
        interval,
    );
    const { book } = useDepthStream(normalizedSymbol);

    const candles = useChartDataStore(
        (state) => state.candles[normalizedSymbol]?.[interval] ?? EMPTY_CANDLES,
    );

    const isLoading = useChartDataStore((state) => {
        const meta = state.seriesMeta[normalizedSymbol]?.[interval];
        return meta?.isLoading ?? false;
    });

    useEffect(() => {
        if (!candle) return;
        const seriesCandle: OHLCV = {
            time: candle.time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume,
        };

        latestLiveCandleRef.current = { key: seriesKey, candle: seriesCandle };
        upsertCandle(normalizedSymbol, interval, seriesCandle);
    }, [candle, interval, normalizedSymbol, seriesKey, upsertCandle]);

    useEffect(() => {
        const controller = new AbortController();
        const requestId = ++requestIdRef.current;
        let timedOut = false;

        setSeriesLoading(normalizedSymbol, interval, true);

        const timeout = setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, HISTORICAL_FETCH_TIMEOUT_MS);

        fetchKlinesSnapshot(
            { symbol: normalizedSymbol, interval, limit: fetchLimit },
            controller.signal,
        )
            .then((historicalCandles) => {
                if (controller.signal.aborted || requestId !== requestIdRef.current) return;
                setErrorState({ key: seriesKey, message: null });
                setHistoricalCandles(normalizedSymbol, interval, historicalCandles);

                // A live update may have arrived while history was in flight.
                // Reapply it so the REST response cannot roll the chart backward.
                const latestLive = latestLiveCandleRef.current;
                if (latestLive?.key === seriesKey) {
                    upsertCandle(normalizedSymbol, interval, latestLive.candle);
                }
            })
            .catch((caught: unknown) => {
                if (requestId !== requestIdRef.current) return;
                if (controller.signal.aborted && !timedOut) return;

                const message = timedOut
                    ? 'Historical candle request timed out'
                    : caught instanceof Error
                        ? caught.message
                        : 'Failed to fetch historical candles';
                setErrorState({ key: seriesKey, message });
            })
            .finally(() => {
                clearTimeout(timeout);
                if (requestId === requestIdRef.current) {
                    setSeriesLoading(normalizedSymbol, interval, false);
                }
            });

        return () => {
            clearTimeout(timeout);
            controller.abort();
            setSeriesLoading(normalizedSymbol, interval, false);
        };
    }, [fetchLimit, interval, normalizedSymbol, seriesKey, setHistoricalCandles, setSeriesLoading, upsertCandle]);

    useEffect(() => {
        if (!options.heatmapEnabled || !book) return;

        const snapshotSymbol = options.orderBookSnapshotSymbol
            ? options.orderBookSnapshotSymbol.toUpperCase()
            : normalizedSymbol;
        setHeatmapCapture(orderBookToSnapshot(book, snapshotSymbol));
    }, [book, options.heatmapEnabled, options.orderBookSnapshotSymbol, normalizedSymbol, setHeatmapCapture]);

    useEffect(() => {
        if (!options.heatmapEnabled || !options.heatmapOverrides) return;
        setHeatmapConfig(normalizedSymbol, options.heatmapOverrides);
    }, [normalizedSymbol, options.heatmapEnabled, options.heatmapOverrides, setHeatmapConfig]);

    const heatmap = useMemo(() => {
        if (!options.heatmapEnabled) return null;
        return buildHeatmap(normalizedSymbol, snapshots, options.heatmapOverrides);
    }, [buildHeatmap, normalizedSymbol, options.heatmapEnabled, options.heatmapOverrides, snapshots]);

    return {
        isConnected,
        lastUpdate,
        reconnectCount,
        latestCandle: candles[candles.length - 1] ?? null,
        candles,
        isLoading,
        error: errorState.key === seriesKey ? errorState.message : null,
        heatmap,
    };
};
