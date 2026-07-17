import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type PaperSide = 'LONG' | 'SHORT';

export interface PaperPosition {
    id: string;
    symbol: string;
    side: PaperSide;
    quantity: number;
    leverage: number;
    entryPrice: number;
    currentPrice: number;
    openedAt: number;
}

export interface PaperTrade extends PaperPosition {
    exitPrice: number;
    closedAt: number;
    realizedPnl: number;
}

interface PortfolioState {
    startingBalance: number;
    realizedPnl: number;
    positions: PaperPosition[];
    trades: PaperTrade[];
    openPosition: (input: Omit<PaperPosition, 'id' | 'currentPrice' | 'openedAt'>) => string;
    closePosition: (id: string, exitPrice: number) => void;
    updatePrice: (symbol: string, price: number) => void;
    setStartingBalance: (balance: number) => void;
    resetPortfolio: () => void;
}

export const calculatePositionPnl = (position: PaperPosition, price = position.currentPrice): number => {
    const direction = position.side === 'LONG' ? 1 : -1;
    return (price - position.entryPrice) * position.quantity * direction;
};

const storage = createJSONStorage(() => {
    if (typeof window === 'undefined') {
        return {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined,
        };
    }
    return window.localStorage;
});

export const usePortfolioStore = create<PortfolioState>()(
    persist(
        (set, get) => ({
            startingBalance: 100_000,
            realizedPnl: 0,
            positions: [],
            trades: [],

            openPosition: (input) => {
                if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
                    throw new Error('Quantity must be greater than zero');
                }
                if (!Number.isFinite(input.entryPrice) || input.entryPrice <= 0) {
                    throw new Error('A live market price is required');
                }

                const id = `paper_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                const position: PaperPosition = {
                    ...input,
                    id,
                    currentPrice: input.entryPrice,
                    openedAt: Date.now(),
                };
                set((state) => ({ positions: [position, ...state.positions] }));
                return id;
            },

            closePosition: (id, exitPrice) => {
                const position = get().positions.find((item) => item.id === id);
                if (!position || !Number.isFinite(exitPrice) || exitPrice <= 0) return;
                const realizedPnl = calculatePositionPnl(position, exitPrice);
                const trade: PaperTrade = {
                    ...position,
                    currentPrice: exitPrice,
                    exitPrice,
                    closedAt: Date.now(),
                    realizedPnl,
                };
                set((state) => ({
                    positions: state.positions.filter((item) => item.id !== id),
                    trades: [trade, ...state.trades].slice(0, 250),
                    realizedPnl: state.realizedPnl + realizedPnl,
                }));
            },

            updatePrice: (symbol, price) => {
                if (!Number.isFinite(price) || price <= 0) return;
                set((state) => ({
                    positions: state.positions.map((position) =>
                        position.symbol === symbol ? { ...position, currentPrice: price } : position
                    ),
                }));
            },

            setStartingBalance: (startingBalance) => {
                if (Number.isFinite(startingBalance) && startingBalance > 0) set({ startingBalance });
            },

            resetPortfolio: () => set({ realizedPnl: 0, positions: [], trades: [] }),
        }),
        {
            name: 'quant-term-paper-portfolio',
            storage,
            partialize: ({ startingBalance, realizedPnl, positions, trades }) => ({
                startingBalance,
                realizedPnl,
                positions,
                trades,
            }),
        }
    )
);

