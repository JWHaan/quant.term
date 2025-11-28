import { useEffect, useMemo, useRef } from 'react';
import { useBinanceWebSocket } from '@/hooks/useBinanceWebSocket';
import { useChartDataStore } from '@/stores/chartDataStore';
import { orderBookToSnapshot, useOrderBookHistoryStore } from '@/stores/orderBookHistoryStore';
import type { OHLCV } from '@/types/common';
import type { HeatmapAggregationResult, HeatmapBinConfig } from '@/utils/heatmap';

const BINANCE_REST_URL = 'https://api.binance.com';
const EMPTY_CANDLES: OHLCV[] = [];

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

const fetchHistoricalCandles = async (
    symbol: string,
    interval: string,
    limit: number
): Promise<OHLCV[]> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
        const response = await fetch(
            `${BINANCE_REST_URL}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
            { signal: controller.signal }
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch candles (${response.status})`);
        }

        const rawData = await response.json();
        if (!Array.isArray(rawData)) {
            throw new Error('Unexpected kline response format');
        }

        return rawData.map((row: any) => ({
            time: Number(row[0]) / 1000,
            open: Number(row[1]),
            high: Number(row[2]),
            low: Number(row[3]),
            close: Number(row[4]),
            volume: Number(row[5]),
        }));
    } finally {
        clearTimeout(timeout);
    }
};

export const useChartDataFeed = (
    symbol: string,
    interval: string,
    options: UseChartDataFeedOptions = {}
): UseChartDataFeedResult => {
    const normalizedSymbol = useMemo(() => symbol.toUpperCase(), [symbol]);
    const fetchLimit = options.fetchLimit ?? 1200;
    const setHeatmapCapture = useOrderBookHistoryStore((state) => state.addSnapshot);
    const snapshots = useOrderBookHistoryStore((state) => state.snapshots);

    const isFetchingRef = useRef(false);
    const errorRef = useRef<string | null>(null);

    const setSeriesLoading = useChartDataStore((state) => state.setSeriesLoading);
    const setHistoricalCandles = useChartDataStore((state) => state.setHistoricalCandles);
    const upsertCandle = useChartDataStore((state) => state.upsertCandle);
    const buildHeatmap = useChartDataStore((state) => state.buildHeatmap);
    const setHeatmapConfig = useChartDataStore((state) => state.setHeatmapConfig);

    const { candle, orderBook, isConnected, lastUpdate, reconnectCount } = useBinanceWebSocket(
        normalizedSymbol.toLowerCase(),
        interval
    );

    const candles = useChartDataStore(
        (state) => state.candles[normalizedSymbol]?.[interval] ?? EMPTY_CANDLES
    );

    const isLoading = useChartDataStore((state) => {
        const meta = state.seriesMeta[normalizedSymbol]?.[interval];
        return meta?.isLoading ?? false;
    });

    useEffect(() => {
        let cancelled = false;
        if (isFetchingRef.current) return;

        isFetchingRef.current = true;
        setSeriesLoading(normalizedSymbol, interval, true);
        errorRef.current = null;

        fetchHistoricalCandles(normalizedSymbol, interval, fetchLimit)
            .then((candles) => {
                if (cancelled) return;
                setHistoricalCandles(normalizedSymbol, interval, candles);
            })
            .catch((err: any) => {
                if (cancelled) return;
                const message = err?.message ?? 'Failed to fetch historical candles';
                errorRef.current = message;
                setSeriesLoading(normalizedSymbol, interval, false);
            })
            .finally(() => {
                isFetchingRef.current = false;
                if (cancelled) {
                    setSeriesLoading(normalizedSymbol, interval, false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [normalizedSymbol, interval, fetchLimit, setSeriesLoading, setHistoricalCandles]);

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

        upsertCandle(normalizedSymbol, interval, seriesCandle);
    }, [candle, interval, normalizedSymbol, upsertCandle]);

    useEffect(() => {
        if (!options.heatmapEnabled || !orderBook) return;

        const snapshotSymbol = options.orderBookSnapshotSymbol
            ? options.orderBookSnapshotSymbol.toUpperCase()
            : normalizedSymbol;

        setHeatmapCapture(orderBookToSnapshot(orderBook, snapshotSymbol));
    }, [orderBook, options.heatmapEnabled, options.orderBookSnapshotSymbol, normalizedSymbol, setHeatmapCapture]);

    useEffect(() => {
        if (!options.heatmapEnabled || !options.heatmapOverrides) {
            return;
        }
        setHeatmapConfig(normalizedSymbol, options.heatmapOverrides);
    }, [normalizedSymbol, options.heatmapEnabled, options.heatmapOverrides, setHeatmapConfig]);

    const heatmap = useMemo(() => {
        if (!options.heatmapEnabled) {
            return null;
        }

        return buildHeatmap(normalizedSymbol, snapshots, options.heatmapOverrides);
    }, [buildHeatmap, normalizedSymbol, options.heatmapEnabled, options.heatmapOverrides, snapshots]);

    return {
        isConnected,
        lastUpdate,
        reconnectCount,
        latestCandle: candles[candles.length - 1] ?? null,
        candles,
        isLoading,
        error: errorRef.current,
        heatmap,
    };
};
