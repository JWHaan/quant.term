import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const MAX_STAT_ARB_SIGNALS = 50;

/**
 * Quant Store - Manages quantitative analysis state
 * Handles correlations, statistical arbitrage, ML predictions, multi-timeframe data
 */

export interface StatArbSignal {
    pair: [string, string];
    correlation: number;
    zScore: number;
    spread: number;
    signal: 'LONG_A_SHORT_B' | 'SHORT_A_LONG_B' | 'NEUTRAL';
    confidence: number;
    timestamp: number;
}

export interface MLPrediction {
    symbol: string;
    direction: 'UP' | 'DOWN' | 'NEUTRAL';
    confidence: number;
    horizon: '15m' | '1h' | '4h';
    features: Record<string, number>;
    featureImportance: Record<string, number>;
    timestamp: number;
}

export interface IndicatorSet {
    rsi?: number;
    macd?: { macd: number; signal: number; histogram: number };
    ema?: number;
    bb?: { upper: number; middle: number; lower: number };
}

export interface TimeframeData {
    '5m': IndicatorSet;
    '15m': IndicatorSet;
    '1h': IndicatorSet;
    '4h': IndicatorSet;
}

export interface SpreadData {
    current: number;
    mean: number;
    stdDev: number;
    zScore: number;
    history: number[];
}

export interface ModelMetrics {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    lastTraining: number;
}

interface QuantState {
    correlationMatrix: Map<string, Map<string, number>>;
    correlationLastUpdate: number;
    statArbSignals: StatArbSignal[];
    pairSpreads: Map<string, SpreadData>;
    mlPredictions: Map<string, MLPrediction>;
    mlModelMetrics: ModelMetrics | null;
    mlLastTraining: number;
    multiTimeframeData: Map<string, TimeframeData>;
    updateCorrelation: (symbolA: string, symbolB: string, correlation: number) => void;
    setCorrelationMatrix: (matrix: Map<string, Map<string, number>>) => void;
    addStatArbSignal: (signal: StatArbSignal) => void;
    clearStatArbSignals: () => void;
    updatePairSpread: (pair: string, spread: SpreadData) => void;
    updateMLPrediction: (symbol: string, prediction: MLPrediction) => void;
    setMLModelMetrics: (metrics: ModelMetrics) => void;
    updateMultiTimeframe: (symbol: string, data: TimeframeData) => void;
    clearMLPredictions: () => void;
    getCorrelation: (symbolA: string, symbolB: string) => number;
    getMLPrediction: (symbol: string) => MLPrediction | null;
    getMultiTimeframe: (symbol: string) => TimeframeData | null;
}

export const useQuantStore = create<QuantState>()(
    persist(
        (set, get) => ({
            correlationMatrix: new Map(),
            correlationLastUpdate: 0,
            statArbSignals: [],
            pairSpreads: new Map(),
            mlPredictions: new Map(),
            mlModelMetrics: null,
            mlLastTraining: 0,
            multiTimeframeData: new Map(),

            updateCorrelation: (symbolA: string, symbolB: string, correlation: number) => {
                set((state) => {
                    const next = new Map(state.correlationMatrix);
                    if (!next.has(symbolA)) next.set(symbolA, new Map());
                    next.get(symbolA)?.set(symbolB, correlation);
                    return { correlationMatrix: next, correlationLastUpdate: Date.now() };
                });
            },

            setCorrelationMatrix: (matrix: Map<string, Map<string, number>>) => {
                set({ correlationMatrix: matrix, correlationLastUpdate: Date.now() });
            },

            addStatArbSignal: (signal: StatArbSignal) => {
                set((state) => ({ statArbSignals: [...state.statArbSignals, signal].slice(-MAX_STAT_ARB_SIGNALS) }));
            },

            clearStatArbSignals: () => set({ statArbSignals: [] }),

            updatePairSpread: (pair: string, spread: SpreadData) => {
                set((state) => {
                    const next = new Map(state.pairSpreads);
                    next.set(pair, spread);
                    return { pairSpreads: next };
                });
            },

            updateMLPrediction: (symbol: string, prediction: MLPrediction) => {
                set((state) => {
                    const next = new Map(state.mlPredictions);
                    next.set(symbol, prediction);
                    return { mlPredictions: next };
                });
            },

            setMLModelMetrics: (metrics: ModelMetrics) => set({ mlModelMetrics: metrics, mlLastTraining: metrics.lastTraining }),

            updateMultiTimeframe: (symbol: string, data: TimeframeData) => {
                set((state) => {
                    const next = new Map(state.multiTimeframeData);
                    next.set(symbol, data);
                    return { multiTimeframeData: next };
                });
            },

            clearMLPredictions: () => set({ mlPredictions: new Map() }),

            getCorrelation: (symbolA: string, symbolB: string): number => get().correlationMatrix.get(symbolA)?.get(symbolB) ?? 0,
            getMLPrediction: (symbol: string): MLPrediction | null => get().mlPredictions.get(symbol) ?? null,
            getMultiTimeframe: (symbol: string): TimeframeData | null => get().multiTimeframeData.get(symbol) ?? null,
        }),
        {
            name: 'quant-store',
            partialize: (state) => ({
                mlModelMetrics: state.mlModelMetrics,
                mlLastTraining: state.mlLastTraining,
            }),
        }
    )
);

export const useStatArbSignals = () => useQuantStore((s) => s.statArbSignals);
export const useMLModelMetrics = () => useQuantStore((s) => s.mlModelMetrics);
export const useMLPrediction = (symbol: string) => useQuantStore((s) => s.mlPredictions.get(symbol) ?? null);
export const useMultiTimeframeData = (symbol: string) => useQuantStore((s) => s.multiTimeframeData.get(symbol) ?? null);

export default useQuantStore;
