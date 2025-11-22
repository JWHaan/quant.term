import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MarketState } from '@/types/stores';
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

            clearMarketData: () => {
                set({ marketData: {}, lastUpdate: null });
            },

            // Getters
            getMarketData: (symbol: string): MarketData | null => {
                const { marketData } = get();
                return marketData[symbol] ?? null;
            },

            isInWatchlist: (symbol: string): boolean => {
                const { watchlist } = get();
                return watchlist.includes(symbol.toUpperCase());
            }
        }),
        {
            name: 'market-store',
            partialize: (state) => ({
                selectedSymbol: state.selectedSymbol,
                watchlist: state.watchlist
            })
        }
    )
);

export default useMarketStore;
