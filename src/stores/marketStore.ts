import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { MarketState, Candle, Trade } from '@/types/stores';
import type { MarketData } from '@/types/binance';

/**
 * Market Store - Global state for market data and symbol selection
 * Persists watchlist and preferences to localStorage
 * 
 * This store manages:
 * - Selected trading symbol
 * - User's watchlist of symbols
 * - Real-time market data cache
 * - Last update timestamp
 */
export const useMarketStore = create<MarketState>()(
    persist(
        (set, get) => ({
            // State
            selectedSymbol: 'BTCUSDT',
            watchlist: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT'],
            marketData: {},
            candles: {},
            trades: {},
            lastUpdate: null,

            // Actions
            setSymbol: (symbol: string) => {
                set({ selectedSymbol: symbol.toUpperCase() });
            },

            addToWatchlist: (symbol: string) => {
                const normalized = symbol.toUpperCase();
                set((state) => ({
                    watchlist: [...new Set([...state.watchlist, normalized])]
                }));
            },

            removeFromWatchlist: (symbol: string) => {
                set((state) => ({
                    watchlist: state.watchlist.filter(s => s !== symbol.toUpperCase())
                }));
            },

            reorderWatchlist: (fromIndex: number, toIndex: number) => {
                set((state) => {
                    const newWatchlist = [...state.watchlist];
                    const [removed] = newWatchlist.splice(fromIndex, 1);
                    if (removed) {
                        newWatchlist.splice(toIndex, 0, removed);
                    }
                    return { watchlist: newWatchlist };
                });
            },

            updateMarketData: (symbol: string, data: Partial<MarketData>) => {
                set((state) => ({
                    marketData: {
                        ...state.marketData,
                        [symbol]: {
                            ...state.marketData[symbol],
                            ...data,
                            timestamp: Date.now()
                        } as MarketData
                    },
                    lastUpdate: Date.now()
                }));
            },

            addCandle: (symbol: string, candle: Candle) => {
                set((state) => {
                    const current = state.candles[symbol] || [];
                    // Circular buffer: max 10,000 items
                    const next = [...current, candle];
                    if (next.length > 10000) {
                        next.splice(0, next.length - 10000);
                    }
                    return {
                        candles: {
                            ...state.candles,
                            [symbol]: next
                        }
                    };
                });
            },

            addTrade: (symbol: string, trade: Trade) => {
                set((state) => {
                    const current = state.trades[symbol] || [];
                    // Circular buffer: max 10,000 items
                    const next = [...current, trade];
                    if (next.length > 10000) {
                        next.splice(0, next.length - 10000);
                    }
                    return {
                        trades: {
                            ...state.trades,
                            [symbol]: next
                        }
                    };
                });
            },

            clearMarketData: () => {
                set({ marketData: {}, candles: {}, trades: {}, lastUpdate: null });
            },

            cleanup: () => {
                set({ candles: {}, trades: {} });
            },

            // Getters
            getMarketData: (symbol: string): MarketData | null => {
                const { marketData } = get();
                return marketData[symbol] ?? null;
            },

            isInWatchlist: (symbol: string): boolean => {
                const { watchlist } = get();
                return watchlist.includes(symbol.toUpperCase());
            },

            getCandles: (symbol: string) => {
                const { candles } = get();
                return candles[symbol] || [];
            },

            getTrades: (symbol: string) => {
                const { trades } = get();
                return trades[symbol] || [];
            }
        }),
        {
            name: 'market-store',
            storage: createJSONStorage(() => {
                // Disable persistence in test environment
                if (process.env.NODE_ENV === 'test') {
                    return {
                        getItem: () => null,
                        setItem: () => { },
                        removeItem: () => { },
                    };
                }
                return localStorage;
            }),
            partialize: (state) => ({
                selectedSymbol: state.selectedSymbol,
                watchlist: state.watchlist
            })
        }
    )
);

export default useMarketStore;
