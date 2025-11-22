import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PortfolioState, Position } from '@/types/stores';

/**
 * Portfolio Store - Manages trading positions and P&L tracking
 * This is a paper trading system for educational purposes only
 * 
 * Features:
 * - Position tracking (LONG/SHORT)
 * - Automatic P&L calculation
 * - Trade history and statistics
 * - Win rate, profit factor, and performance metrics
 */

/**
 * Calculate P&L for a position
 * @param position - Position with entry price, size, and side
 * @param exitPrice - Exit/current price
 * @returns Profit or loss in USD
 */
function calculatePnL(position: Position, exitPrice: number): number {
    const multiplier = position.side === 'LONG' ? 1 : -1;
    const priceDiff = exitPrice - position.entryPrice;
    return multiplier * priceDiff * position.size;
}

export const usePortfolioStore = create<PortfolioState>()(
    persist(
        (set, get) => ({
            // State
            positions: [],
            totalPnl: 0,
            totalPnlPercent: 0,
            accountBalance: 10000,

            // Actions
            addPosition: (position: Omit<Position, 'pnl' | 'pnlPercent' | 'timestamp'>) => {
                const newPosition: Position = {
                    ...position,
                    pnl: 0,
                    pnlPercent: 0,
                    timestamp: Date.now()
                };

                set(state => ({
                    positions: [...state.positions, newPosition]
                }));
            },

            removePosition: (symbol: string) => {
                set(state => ({
                    positions: state.positions.filter(p => p.symbol !== symbol)
                }));
            },

            updatePosition: (symbol: string, updates: Partial<Position>) => {
                set(state => ({
                    positions: state.positions.map(p =>
                        p.symbol === symbol
                            ? { ...p, ...updates }
                            : p
                    )
                }));
            },

            updatePrices: (prices: Record<string, number>) => {
                set(state => {
                    const updatedPositions = state.positions.map(position => {
                        const currentPrice = prices[position.symbol];
                        if (currentPrice === undefined) return position;

                        const pnl = calculatePnL(position, currentPrice);
                        const pnlPercent = (pnl / (position.entryPrice * position.size)) * 100;

                        return {
                            ...position,
                            currentPrice,
                            pnl,
                            pnlPercent
                        };
                    });

                    const totalPnl = updatedPositions.reduce((sum, p) => sum + p.pnl, 0);
                    const totalPnlPercent = (totalPnl / state.accountBalance) * 100;

                    return {
                        positions: updatedPositions,
                        totalPnl,
                        totalPnlPercent
                    };
                });
            },

            setAccountBalance: (balance: number) => {
                set({ accountBalance: balance });
            },

            clearPositions: () => {
                set({
                    positions: [],
                    totalPnl: 0,
                    totalPnlPercent: 0
                });
            },

            // Getters
            getPosition: (symbol: string): Position | null => {
                const position = get().positions.find(p => p.symbol === symbol);
                return position ?? null;
            },

            getTotalExposure: (): number => {
                return get().positions.reduce((sum, p) => {
                    return sum + (p.size * p.currentPrice * p.leverage);
                }, 0);
            }
        }),
        {
            name: 'portfolio-store',
            version: 1,
            partialize: (state) => ({
                positions: state.positions,
                accountBalance: state.accountBalance
            })
        }
    )
);

export default usePortfolioStore;
