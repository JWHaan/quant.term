import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
    // Correlation data
    correlationMatrix: Map<string, Map<string, number>>;
    correlationLastUpdate: number;
    
    // Statistical arbitrage
    statArbSignals: StatArbSignal[];
    pairSpreads: Map<string, SpreadData>;
    
    // ML predictions
    mlPredictions: Map<string, MLPrediction>;
    mlModelMetrics: ModelMetrics | null;
    mlLastTraining: number;
    
    // Multi-timeframe data
    multiTimeframeData: Map<string, TimeframeData>;
    
    // Actions
    updateCorrelation: (symbolA: string, symbolB: string, correlation: number) => void;
    setCorrelationMatrix: (matrix: Map<string, Map<string, number>>) => void;
    addStatArbSignal: (signal: StatArbSignal) => void;
    clearStatArbSignals: () => void;
    updatePairSpread: (pair: string, spread: SpreadData) => void;
    updateMLPrediction: (symbol: string, prediction: MLPrediction) => void;
    setMLModelMetrics: (metrics: ModelMetrics) => void;
    updateMultiTimeframe: (symbol: string, data: TimeframeData) => void;
    clearMLPredictions: () => void;
    
    // Getters
    getCorrelation: (symbolA: string, symbolB: string) => number;
    getMLPrediction: (symbol: string) => MLPrediction | null;
    getMultiTimeframe: (symbol: string) => TimeframeData | null;
}

export const useQuantStore = create<QuantState>()(
    persist(
        (set, get) => ({
            // State
            correlationMatrix: new Map(),
            correlationLastUpdate: 0,
            statArbSignals: [],
            pairSpreads: new Map(),
            mlPredictions: new Map(),
            mlModelMetrics: null,
            mlLastTraining: 0,
            multiTimeframeData: new Map(),

            // Actions
            updateCorrelation: (symbolA: string, symbolB: string, correlation: number) => {
                set((state) => {
                    const newMatrix = new Map(state.correlationMatrix);
                    
                    if (!newMatrix.has(symbolA)) {
                        newMatrix.set(symbolA, new Map());
                    }
                    newMatrix.get(symbolA)!.set(symbolB, correlation);
                    
                    return {
                        correlationMatrix: newMatrix,
                        correlationLastUpdate: Date.now()
                    };
                });
            },

            setCorrelationMatrix: (matrix: Map<string, Map<string, number>>) => {
                set({
                    correlationMatrix: matrix,
                    correlationLastUpdate: Date.now()
                });
            },

            addStatArbSignal: (signal: StatArbSignal) => {
                set((state) => ({
                    statArbSignals: [...state.statArbSignals, signal].slice(-50) // Keep last 50
                }));
            },

            clearStatArbSignals: () => {
                set({ statArbSignals: [] });
            },

            updatePairSpread: (pair: string, spread: SpreadData) => {
                set((state) => {
                    const newSpreads = new Map(state.pairSpreads);
                    newSpreads.set(pair, spread);
                    return { pairSpreads: newSpreads };
                });
            },

            updateMLPrediction: (symbol: string, prediction: MLPrediction) => {
                set((state) => {
                    const newPredictions = new Map(state.mlPredictions);
                    newPredictions.set(symbol, prediction);
                    return { mlPredictions: newPredictions };
                });
            },

            setMLModelMetrics: (metrics: ModelMetrics) => {
                set({
                    mlModelMetrics: metrics,
                    mlLastTraining: metrics.lastTraining
                });
            },

            updateMultiTimeframe: (symbol: string, data: TimeframeData) => {
                set((state) => {
                    const newData = new Map(state.multiTimeframeData);
                    newData.set(symbol, data);
                    return { multiTimeframeData: newData };
                });
            },

            clearMLPredictions: () => {
                set({ mlPredictions: new Map() });
            },

            // Getters
            getCorrelation: (symbolA: string, symbolB: string): number => {
                const { correlationMatrix } = get();
                return correlationMatrix.get(symbolA)?.get(symbolB) ?? 0;
            },

            getMLPrediction: (symbol: string): MLPrediction | null => {
                const { mlPredictions } = get();
                return mlPredictions.get(symbol) ?? null;
            },

            getMultiTimeframe: (symbol: string): TimeframeData | null => {
                const { multiTimeframeData } = get();
                return multiTimeframeData.get(symbol) ?? null;
            }
        }),
        {
            name: 'quant-store',
            partialize: (state) => ({
                mlModelMetrics: state.mlModelMetrics,
                mlLastTraining: state.mlLastTraining
            })
        }
    )
);

export default useQuantStore;
