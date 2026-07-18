import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { MarketState, Candle, Trade } from '@/types/stores';
import type { MarketData } from '@/types/binance';
import {
    DEFAULT_SYMBOL,
    DEFAULT_WATCHLIST,
    CANDLE_BUFFER_SIZE,
    TRADE_BUFFER_SIZE,
    normalizeBinanceSpotSymbol,
} from '@/constants/config';

/**
 * Market Store — global state for market data and symbol selection.
 * Persists watchlist and selected symbol to localStorage.
 */
export const useMarketStore = create<MarketState>()(
    persist(
        (set, get) => ({
            // ─── State ───────────────────────────────────────────────────────
            selectedSymbol: DEFAULT_SYMBOL,
            watchlist: [...DEFAULT_WATCHLIST],
            marketData: {},
            candles: {},
            trades: {},
            lastUpdate: null,

            // ─── Actions ─────────────────────────────────────────────────────
            setSymbol: (symbol: string) =>
                set({ selectedSymbol: normalizeBinanceSpotSymbol(symbol) }),

            addToWatchlist: (symbol: string) => {
                const normalized = normalizeBinanceSpotSymbol(symbol);
                set((state) => ({
                    watchlist: [...new Set([...state.watchlist, normalized])]
                }));
            },

            removeFromWatchlist: (symbol: string) =>
                set((state) => ({
                    watchlist: state.watchlist.filter(s => s !== normalizeBinanceSpotSymbol(symbol))
                })),

            reorderWatchlist: (fromIndex: number, toIndex: number) =>
                set((state) => {
                    const next = [...state.watchlist];
                    const [removed] = next.splice(fromIndex, 1);
                    if (removed !== undefined) next.splice(toIndex, 0, removed);
                    return { watchlist: next };
                }),

            updateMarketData: (symbol: string, data: Partial<MarketData>) => {
                const normalized = normalizeBinanceSpotSymbol(symbol);
                set((state) => ({
                    marketData: {
                        ...state.marketData,
                        [normalized]: {
                            ...state.marketData[normalized],
                            ...data,
                            symbol: normalized,
                            timestamp: typeof data.timestamp === 'number' && data.timestamp > 0
                                ? data.timestamp
                                : Date.now()
                        } as MarketData
                    },
                    lastUpdate: Date.now()
                }));
            },

            addCandle: (symbol: string, candle: Candle) =>
                set((state) => {
                    const current = state.candles[symbol] ?? [];
                    const next = [...current, candle];
                    if (next.length > CANDLE_BUFFER_SIZE) next.splice(0, next.length - CANDLE_BUFFER_SIZE);
                    return { candles: { ...state.candles, [symbol]: next } };
                }),

            addTrade: (symbol: string, trade: Trade) =>
                set((state) => {
                    const current = state.trades[symbol] ?? [];
                    const next = [...current, trade];
                    if (next.length > TRADE_BUFFER_SIZE) next.splice(0, next.length - TRADE_BUFFER_SIZE);
                    return { trades: { ...state.trades, [symbol]: next } };
                }),

            clearMarketData: () =>
                set({ marketData: {}, candles: {}, trades: {}, lastUpdate: null }),

            cleanup: () =>
                set({ candles: {}, trades: {} }),

            // ─── Getters ─────────────────────────────────────────────────────
            getMarketData: (symbol: string): MarketData | null =>
                get().marketData[normalizeBinanceSpotSymbol(symbol)] ?? null,

            isInWatchlist: (symbol: string): boolean =>
                get().watchlist.includes(normalizeBinanceSpotSymbol(symbol)),

            getCandles: (symbol: string) =>
                get().candles[symbol] ?? [],

            getTrades: (symbol: string) =>
                get().trades[symbol] ?? [],
        }),
        {
            name: 'market-store',
            storage: createJSONStorage(() => {
                if (import.meta.env.MODE === 'test') {
                    return {
                        getItem: () => null,
                        setItem: () => {},
                        removeItem: () => {},
                    };
                }
                return localStorage;
            }),
            partialize: (state) => ({
                selectedSymbol: state.selectedSymbol,
                watchlist: state.watchlist
            }),
            merge: (persistedState, currentState) => {
                const persisted = persistedState as Partial<Pick<MarketState, 'selectedSymbol' | 'watchlist'>>;
                return {
                    ...currentState,
                    ...persisted,
                    selectedSymbol: normalizeBinanceSpotSymbol(persisted.selectedSymbol ?? currentState.selectedSymbol),
                    watchlist: [...new Set((persisted.watchlist ?? currentState.watchlist).map(normalizeBinanceSpotSymbol))],
                };
            },
        }
    )
);

// ─── Typed Selectors ─────────────────────────────────────────────────────────
// Use these in components instead of selecting the whole store.
// This prevents unnecessary re-renders when unrelated state changes.
export const useSelectedSymbol = () => useMarketStore(s => s.selectedSymbol);
export const useWatchlist = () => useMarketStore(s => s.watchlist);
export const useSetSymbol = () => useMarketStore(s => s.setSymbol);
export const useMarketData = (symbol: string) => useMarketStore(s => s.marketData[symbol] ?? null);

export default useMarketStore;
