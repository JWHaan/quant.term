import { describe, it, expect, beforeEach } from 'vitest';
import { useMarketStore } from '@/stores/marketStore';
import { Candle, Trade } from '@/types/stores';

describe('marketStore', () => {
    beforeEach(() => {
        useMarketStore.getState().clearMarketData();
    });

    it('should add candles and respect circular buffer limit', () => {
        const store = useMarketStore.getState();
        const symbol = 'BTCUSDT';

        // Add 10005 candles
        for (let i = 0; i < 10005; i++) {
            const candle: Candle = {
                time: i,
                open: 100,
                high: 110,
                low: 90,
                close: 105,
                volume: 1000
            };
            store.addCandle(symbol, candle);
        }

        const updatedStore = useMarketStore.getState();
        const candles = updatedStore.getCandles(symbol);

        expect(candles.length).toBe(10000);
        expect(candles[0]?.time).toBe(5); // First 5 should be dropped
        expect(candles[9999]?.time).toBe(10004);
    });

    it('should add trades and respect circular buffer limit', () => {
        const store = useMarketStore.getState();
        const symbol = 'ETHUSDT';

        // Add 10005 trades
        for (let i = 0; i < 10005; i++) {
            const trade: Trade = {
                id: i,
                time: '12:00:00',
                price: 2000,
                size: 1,
                side: 'BUY',
                symbol
            };
            store.addTrade(symbol, trade);
        }

        const updatedStore = useMarketStore.getState();
        const trades = updatedStore.getTrades(symbol);

        expect(trades.length).toBe(10000);
        expect(trades[0]?.id).toBe(5);
        expect(trades[9999]?.id).toBe(10004);
    });

    it('should cleanup data', () => {
        const store = useMarketStore.getState();
        const symbol = 'SOLUSDT';

        store.addCandle(symbol, { time: 1, open: 1, high: 1, low: 1, close: 1, volume: 1 });
        store.addTrade(symbol, { id: 1, time: '1', price: 1, size: 1, side: 'BUY', symbol });

        expect(useMarketStore.getState().getCandles(symbol).length).toBe(1);
        expect(useMarketStore.getState().getTrades(symbol).length).toBe(1);

        store.cleanup();

        expect(useMarketStore.getState().getCandles(symbol).length).toBe(0);
        expect(useMarketStore.getState().getTrades(symbol).length).toBe(0);
    });
});
