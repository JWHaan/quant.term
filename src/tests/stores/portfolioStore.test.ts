import { beforeEach, describe, expect, it } from 'vitest';
import {
    calculatePositionMargin,
    calculatePositionPnl,
    usePortfolioStore,
    type PaperPosition,
} from '@/stores/portfolioStore';

type PositionInput = Omit<PaperPosition, 'id' | 'currentPrice' | 'openedAt'>;

const makePositionInput = (overrides: Partial<PositionInput> = {}): PositionInput => ({
    symbol: 'BTCUSDT',
    side: 'LONG',
    quantity: 2,
    leverage: 5,
    entryPrice: 100,
    ...overrides,
});

describe('portfolioStore', () => {
    beforeEach(() => {
        window.localStorage.removeItem('quant-term-paper-portfolio');
        usePortfolioStore.setState({
            startingBalance: 100_000,
            realizedPnl: 0,
            positions: [],
            trades: [],
        });
    });

    it('calculates long and short P&L from the current or supplied mark', () => {
        const long: PaperPosition = {
            ...makePositionInput(),
            id: 'long',
            currentPrice: 112,
            openedAt: 1,
        };
        const short: PaperPosition = {
            ...makePositionInput({ side: 'SHORT', quantity: 3, entryPrice: 200 }),
            id: 'short',
            currentPrice: 180,
            openedAt: 2,
        };

        expect(calculatePositionPnl(long)).toBe(24);
        expect(calculatePositionPnl(long, 90)).toBe(-20);
        expect(calculatePositionPnl(short)).toBe(60);
        expect(calculatePositionPnl(short, 220)).toBe(-60);
        expect(calculatePositionMargin(long)).toBe(40);
        expect(calculatePositionMargin({ ...long, leverage: 1 })).toBe(200);
    });

    it('opens a position at the live mark and updates only matching symbols', () => {
        const beforeOpen = Date.now();
        const id = usePortfolioStore.getState().openPosition(makePositionInput());
        const opened = usePortfolioStore.getState().positions[0];

        expect(id).toMatch(/^paper_\d+_[a-z0-9]+$/);
        expect(opened).toMatchObject({
            id,
            symbol: 'BTCUSDT',
            side: 'LONG',
            quantity: 2,
            leverage: 5,
            entryPrice: 100,
            currentPrice: 100,
        });
        expect(opened?.openedAt).toBeGreaterThanOrEqual(beforeOpen);

        usePortfolioStore.getState().openPosition(makePositionInput({ symbol: 'ETHUSDT', entryPrice: 50 }));
        usePortfolioStore.getState().updatePrice('BTCUSDT', 125);

        const state = usePortfolioStore.getState();
        expect(state.positions.find((position) => position.symbol === 'BTCUSDT')?.currentPrice).toBe(125);
        expect(state.positions.find((position) => position.symbol === 'ETHUSDT')?.currentPrice).toBe(50);

        state.updatePrice('BTCUSDT', Number.NaN);
        state.updatePrice('BTCUSDT', 0);
        expect(usePortfolioStore.getState().positions.find((position) => position.symbol === 'BTCUSDT')?.currentPrice).toBe(125);
    });

    it.each([
        ['zero quantity', { quantity: 0 }, 'Quantity must be greater than zero'],
        ['negative quantity', { quantity: -1 }, 'Quantity must be greater than zero'],
        ['non-finite quantity', { quantity: Number.NaN }, 'Quantity must be greater than zero'],
        ['zero entry', { entryPrice: 0 }, 'A live market price is required'],
        ['non-finite entry', { entryPrice: Number.POSITIVE_INFINITY }, 'A live market price is required'],
        ['zero leverage', { leverage: 0 }, 'Leverage must be an integer from 1 to 100'],
        ['fractional leverage', { leverage: 1.5 }, 'Leverage must be an integer from 1 to 100'],
        ['excessive leverage', { leverage: 101 }, 'Leverage must be an integer from 1 to 100'],
        ['insufficient margin', { quantity: 10_000, leverage: 1 }, 'Insufficient free paper margin'],
    ])('rejects %s', (_label, overrides, message) => {
        expect(() => usePortfolioStore.getState().openPosition(makePositionInput(overrides))).toThrow(message);
        expect(usePortfolioStore.getState().positions).toHaveLength(0);
    });

    it('closes positions into immutable trade history and accumulates realized P&L', () => {
        const longId = usePortfolioStore.getState().openPosition(makePositionInput());
        usePortfolioStore.getState().updatePrice('BTCUSDT', 110);
        usePortfolioStore.getState().closePosition(longId, 115);

        let state = usePortfolioStore.getState();
        expect(state.positions).toHaveLength(0);
        expect(state.realizedPnl).toBe(30);
        expect(state.trades[0]).toMatchObject({
            id: longId,
            entryPrice: 100,
            currentPrice: 115,
            exitPrice: 115,
            realizedPnl: 30,
        });

        const shortId = state.openPosition(makePositionInput({
            symbol: 'ETHUSDT',
            side: 'SHORT',
            quantity: 4,
            entryPrice: 50,
        }));
        usePortfolioStore.getState().closePosition(shortId, 45);

        state = usePortfolioStore.getState();
        expect(state.realizedPnl).toBe(50);
        expect(state.trades.map((trade) => trade.realizedPnl)).toEqual([20, 30]);
        expect(state.trades[0]?.closedAt).toBeGreaterThanOrEqual(state.trades[0]?.openedAt ?? 0);
    });

    it('ignores unknown positions and invalid exit prices', () => {
        const id = usePortfolioStore.getState().openPosition(makePositionInput());

        usePortfolioStore.getState().closePosition('missing', 120);
        usePortfolioStore.getState().closePosition(id, 0);
        usePortfolioStore.getState().closePosition(id, Number.NaN);

        const state = usePortfolioStore.getState();
        expect(state.positions).toHaveLength(1);
        expect(state.trades).toHaveLength(0);
        expect(state.realizedPnl).toBe(0);
    });

    it('resets trading activity while preserving a valid configured balance', () => {
        const store = usePortfolioStore.getState();
        store.setStartingBalance(25_000);
        const id = store.openPosition(makePositionInput());
        usePortfolioStore.getState().closePosition(id, 125);

        usePortfolioStore.getState().setStartingBalance(0);
        usePortfolioStore.getState().setStartingBalance(Number.NaN);
        usePortfolioStore.getState().resetPortfolio();

        expect(usePortfolioStore.getState()).toMatchObject({
            startingBalance: 25_000,
            realizedPnl: 0,
            positions: [],
            trades: [],
        });
    });
});
