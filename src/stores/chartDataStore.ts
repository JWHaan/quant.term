import { create } from 'zustand';
import type { OHLCV } from '@/types/common';
import type { OrderBookSnapshot } from '@/stores/orderBookHistoryStore';
import {
    aggregateOrderBookSnapshotsToHeatmap,
    mergeHeatmapConfig,
    type HeatmapAggregationResult,
    type HeatmapBinConfig,
} from '@/utils/heatmap';

const DEFAULT_MAX_CANDLES = 1800;
const HARD_CAP_MAX_CANDLES = 10000;

type IntervalKey = string;
type SymbolKey = string;

interface SeriesMeta {
    isLoading: boolean;
    lastUpdated: number | null;
}

export interface ChartDataState {
    candles: Record<SymbolKey, Record<IntervalKey, OHLCV[]>>;
    seriesMeta: Record<SymbolKey, Record<IntervalKey, SeriesMeta>>;
    maxCandles: number;
    heatmapConfig: Record<SymbolKey, Partial<HeatmapBinConfig>>;

    setMaxCandles: (max: number) => void;
    setSeriesLoading: (symbol: string, interval: string, isLoading: boolean) => void;
    setHistoricalCandles: (symbol: string, interval: string, candles: OHLCV[]) => void;
    upsertCandle: (symbol: string, interval: string, candle: OHLCV) => void;
    clearCandles: (symbol?: string, interval?: string) => void;
    getCandles: (symbol: string, interval: string) => OHLCV[];

    setHeatmapConfig: (symbol: string, config: Partial<HeatmapBinConfig>) => void;
    resetHeatmapConfig: (symbol?: string) => void;
    buildHeatmap: (
        symbol: string,
        snapshots: OrderBookSnapshot[],
        overrides?: Partial<HeatmapBinConfig>,
        now?: number
    ) => HeatmapAggregationResult;
}

const normalizeSymbol = (symbol: string): SymbolKey => symbol.toUpperCase();

const clampCandles = (candles: OHLCV[], max: number): OHLCV[] => {
    if (candles.length <= max) {
        return candles;
    }
    return candles.slice(candles.length - max);
};

const normalizeCandles = (candles: OHLCV[]): OHLCV[] => {
    const dedup = new Map<number, OHLCV>();

    candles.forEach((candle) => {
        if (!Number.isFinite(candle.time)) {
            return;
        }
        dedup.set(candle.time, candle);
    });

    return Array.from(dedup.values()).sort((a, b) => a.time - b.time);
};

const ensurePositive = (value: number, label: string) => {
    if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`${label} must be a positive finite number`);
    }
};

export const useChartDataStore = create<ChartDataState>((set, get) => ({
    candles: {},
    seriesMeta: {},
    maxCandles: DEFAULT_MAX_CANDLES,
    heatmapConfig: {},

    setMaxCandles: (max: number) => {
        ensurePositive(max, 'maxCandles');
        set(() => ({
            maxCandles: Math.min(max, HARD_CAP_MAX_CANDLES),
        }));
    },

    setSeriesLoading: (symbol: string, interval: string, isLoading: boolean) => {
        const sym = normalizeSymbol(symbol);
        set((state) => {
            const seriesMeta = { ...state.seriesMeta };
            const metaForSymbol = { ...(seriesMeta[sym] ?? {}) };
            const currentMeta: SeriesMeta = metaForSymbol[interval] ?? {
                isLoading: false,
                lastUpdated: null,
            };

            metaForSymbol[interval] = {
                ...currentMeta,
                isLoading,
            };

            seriesMeta[sym] = metaForSymbol;
            return { seriesMeta };
        });
    },

    setHistoricalCandles: (symbol: string, interval: string, candles: OHLCV[]) => {
        const sym = normalizeSymbol(symbol);
        set((state) => {
            const normalized = clampCandles(normalizeCandles(candles), state.maxCandles);

            const candlesState = { ...state.candles };
            const candlesForSymbol = { ...(candlesState[sym] ?? {}) };
            candlesForSymbol[interval] = normalized;
            candlesState[sym] = candlesForSymbol;

            const seriesMeta = { ...state.seriesMeta };
            const metaForSymbol = { ...(seriesMeta[sym] ?? {}) };
            const previousMeta = metaForSymbol[interval] ?? { isLoading: false, lastUpdated: null };
            metaForSymbol[interval] = {
                ...previousMeta,
                isLoading: false,
                lastUpdated: normalized.length ? Date.now() : previousMeta.lastUpdated,
            };
            seriesMeta[sym] = metaForSymbol;

            return {
                candles: candlesState,
                seriesMeta,
            };
        });
    },

    upsertCandle: (symbol: string, interval: string, candle: OHLCV) => {
        const sym = normalizeSymbol(symbol);
        set((state) => {
            const candlesState = { ...state.candles };
            const candlesForSymbol = { ...(candlesState[sym] ?? {}) };
            const existingSeries = candlesForSymbol[interval] ? [...candlesForSymbol[interval]!] : [];

            const nextSeries = clampCandles(normalizeCandles([...existingSeries, candle]), state.maxCandles);
            candlesForSymbol[interval] = nextSeries;
            candlesState[sym] = candlesForSymbol;

            const seriesMeta = { ...state.seriesMeta };
            const metaForSymbol = { ...(seriesMeta[sym] ?? {}) };
            const previousMeta = metaForSymbol[interval] ?? { isLoading: false, lastUpdated: null };
            metaForSymbol[interval] = {
                ...previousMeta,
                isLoading: false,
                lastUpdated: Date.now(),
            };
            seriesMeta[sym] = metaForSymbol;

            return {
                candles: candlesState,
                seriesMeta,
            };
        });
    },

    clearCandles: (symbol?: string, interval?: string) => {
        if (!symbol) {
            set({ candles: {}, seriesMeta: {} });
            return;
        }

        const sym = normalizeSymbol(symbol);
        set((state) => {
            const candlesState = { ...state.candles };
            const seriesMeta = { ...state.seriesMeta };

            if (!interval) {
                delete candlesState[sym];
                delete seriesMeta[sym];
                return { candles: candlesState, seriesMeta };
            }

            if (candlesState[sym]) {
                const candlesForSymbol = { ...candlesState[sym]! };
                delete candlesForSymbol[interval];
                if (Object.keys(candlesForSymbol).length === 0) {
                    delete candlesState[sym];
                } else {
                    candlesState[sym] = candlesForSymbol;
                }
            }

            if (seriesMeta[sym]) {
                const metaForSymbol = { ...seriesMeta[sym]! };
                delete metaForSymbol[interval];
                if (Object.keys(metaForSymbol).length === 0) {
                    delete seriesMeta[sym];
                } else {
                    seriesMeta[sym] = metaForSymbol;
                }
            }

            return { candles: candlesState, seriesMeta };
        });
    },

    getCandles: (symbol: string, interval: string) => {
        const sym = normalizeSymbol(symbol);
        const { candles } = get();
        return candles[sym]?.[interval] ?? [];
    },

    setHeatmapConfig: (symbol: string, config: Partial<HeatmapBinConfig>) => {
        const sym = normalizeSymbol(symbol);
        set((state) => {
            const heatmapConfig = { ...state.heatmapConfig };
            const merged = mergeHeatmapConfig(heatmapConfig[sym], config);
            heatmapConfig[sym] = merged;
            return { heatmapConfig };
        });
    },

    resetHeatmapConfig: (symbol?: string) => {
        if (!symbol) {
            set({ heatmapConfig: {} });
            return;
        }

        const sym = normalizeSymbol(symbol);
        set((state) => {
            const heatmapConfig = { ...state.heatmapConfig };
            delete heatmapConfig[sym];
            return { heatmapConfig };
        });
    },

    buildHeatmap: (
        symbol: string,
        snapshots: OrderBookSnapshot[],
        overrides?: Partial<HeatmapBinConfig>,
        now?: number
    ) => {
        const sym = normalizeSymbol(symbol);
        const { heatmapConfig } = get();
        const mergedConfig = mergeHeatmapConfig(heatmapConfig[sym], overrides);
        const filteredSnapshots = snapshots.filter((snapshot) => snapshot.symbol === sym);

        return aggregateOrderBookSnapshotsToHeatmap(filteredSnapshots, mergedConfig, now);
    },
}));
