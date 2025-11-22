import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { OHLCV } from '@/types/common';

/**
 * Backtest Store - Manages backtesting state
 * Handles strategy configuration, execution, and results
 */

export interface Rule {
    type: 'INDICATOR' | 'PRICE' | 'TIME';
    indicator?: string;
    condition: 'ABOVE' | 'BELOW' | 'CROSSES_ABOVE' | 'CROSSES_BELOW' | 'EQUALS';
    value: number;
    logic: 'AND' | 'OR';
}

export interface StrategyConfig {
    name: string;
    symbol: string;
    timeframe: string;
    startDate: number;
    endDate: number;
    initialCapital: number;
    positionSize: number;
    
    // Entry rules
    entryRules: Rule[];
    
    // Exit rules
    exitRules: Rule[];
    
    // Risk management
    stopLoss?: number;
    takeProfit?: number;
    maxPositions: number;
}

export interface Trade {
    id: string;
    symbol: string;
    type: 'LONG' | 'SHORT';
    entryPrice: number;
    exitPrice: number;
    size: number;
    entryTime: number;
    exitTime: number;
    pnl: number;
    pnlPercent: number;
    fees: number;
    reason: string;
}

export interface EquityPoint {
    time: number;
    equity: number;
    drawdown: number;
}

export interface BacktestResults {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    profitFactor: number;
    totalTrades: number;
    avgWin: number;
    avgLoss: number;
    largestWin: number;
    largestLoss: number;
    avgHoldingPeriod: number;
    expectancy: number;
}

interface BacktestState {
    // Strategy configuration
    strategy: StrategyConfig | null;
    
    // Execution state
    isRunning: boolean;
    progress: number;
    
    // Results
    results: BacktestResults | null;
    trades: Trade[];
    equityCurve: EquityPoint[];
    
    // Historical data cache
    historicalData: Map<string, OHLCV[]>;
    
    // Actions
    setStrategy: (strategy: StrategyConfig) => void;
    setRunning: (isRunning: boolean) => void;
    setProgress: (progress: number) => void;
    setResults: (results: BacktestResults) => void;
    setTrades: (trades: Trade[]) => void;
    setEquityCurve: (curve: EquityPoint[]) => void;
    clearResults: () => void;
    cacheHistoricalData: (symbol: string, data: OHLCV[]) => void;
    getHistoricalData: (symbol: string) => OHLCV[] | null;
}

export const useBacktestStore = create<BacktestState>()(
    persist(
        (set, get) => ({
            // State
            strategy: null,
            isRunning: false,
            progress: 0,
            results: null,
            trades: [],
            equityCurve: [],
            historicalData: new Map(),

            // Actions
            setStrategy: (strategy: StrategyConfig) => {
                set({ strategy });
            },

            setRunning: (isRunning: boolean) => {
                set({ isRunning });
            },

            setProgress: (progress: number) => {
                set({ progress: Math.min(100, Math.max(0, progress)) });
            },

            setResults: (results: BacktestResults) => {
                set({ results });
            },

            setTrades: (trades: Trade[]) => {
                set({ trades });
            },

            setEquityCurve: (curve: EquityPoint[]) => {
                set({ equityCurve: curve });
            },

            clearResults: () => {
                set({
                    results: null,
                    trades: [],
                    equityCurve: [],
                    progress: 0
                });
            },

            cacheHistoricalData: (symbol: string, data: OHLCV[]) => {
                set((state) => {
                    const newCache = new Map(state.historicalData);
                    newCache.set(symbol, data);
                    return { historicalData: newCache };
                });
            },

            getHistoricalData: (symbol: string): OHLCV[] | null => {
                const { historicalData } = get();
                return historicalData.get(symbol) ?? null;
            }
        }),
        {
            name: 'backtest-store',
            partialize: (state) => ({
                strategy: state.strategy,
                results: state.results,
                trades: state.trades
            })
        }
    )
);

export default useBacktestStore;
