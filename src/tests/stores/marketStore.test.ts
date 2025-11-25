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

    it('should set symbol', () => {
        const store = useMarketStore.getState();
        store.setSymbol('ethusdt');
        expect(useMarketStore.getState().selectedSymbol).toBe('ETHUSDT');
    });

    it('should add to watchlist', () => {
        const store = useMarketStore.getState();
        const initialLength = store.watchlist.length;

        store.addToWatchlist('LINKUSDT');
        expect(useMarketStore.getState().watchlist).toContain('LINKUSDT');
        expect(useMarketStore.getState().watchlist.length).toBe(initialLength + 1);
    });

    it('should not add duplicate to watchlist', () => {
        const store = useMarketStore.getState();
        store.addToWatchlist('BTCUSDT'); // Already in default watchlist

        const watchlist = useMarketStore.getState().watchlist;
        const btcCount = watchlist.filter(s => s === 'BTCUSDT').length;
        expect(btcCount).toBe(1);
    });

    it('should remove from watchlist', () => {
        const store = useMarketStore.getState();
        store.removeFromWatchlist('BTCUSDT');
        expect(useMarketStore.getState().watchlist).not.toContain('BTCUSDT');
    });

    it('should reorder watchlist', () => {
        const store = useMarketStore.getState();
        const originalFirst = store.watchlist[0];
        const originalSecond = store.watchlist[1];

        store.reorderWatchlist(0, 1);

        const newWatchlist = useMarketStore.getState().watchlist;
        expect(newWatchlist[0]).toBe(originalSecond);
        expect(newWatchlist[1]).toBe(originalFirst);
    });

    it('should update market data', () => {
        const store = useMarketStore.getState();
        const symbol = 'BTCUSDT';

        store.updateMarketData(symbol, {
            symbol,
            price: 50000,
            priceChange: 1000,
            priceChangePercent: 2,
            volume: 1000000,
            quoteVolume: 50000000000,
            high: 51000,
            low: 49000,
            timestamp: Date.now()
        });

        const marketData = useMarketStore.getState().getMarketData(symbol);
        expect(marketData).toBeDefined();
        expect(marketData?.price).toBe(50000);
        expect(marketData?.high).toBe(51000);
    });

    it('should check if symbol is in watchlist', () => {
        const store = useMarketStore.getState();
        store.addToWatchlist('BTCUSDT');
        expect(store.isInWatchlist('BTCUSDT')).toBe(true);
        expect(store.isInWatchlist('XYZUSDT')).toBe(false);
    });

    it('should return null for non-existent market data', () => {
        const store = useMarketStore.getState();
        const data = store.getMarketData('NONEXISTENT');
        expect(data).toBeNull();
    });

    it('should return empty array for non-existent candles', () => {
        const store = useMarketStore.getState();
        const candles = store.getCandles('NONEXISTENT');
        expect(candles).toEqual([]);
    });

    it('should return empty array for non-existent trades', () => {
        const store = useMarketStore.getState();
        const trades = store.getTrades('NONEXISTENT');
        expect(trades).toEqual([]);
    });
});

