import { describe, it, expect, beforeEach } from 'vitest';
import { useMarketStore } from '@/stores/marketStore';

describe('marketStore', () => {
    beforeEach(() => {
        useMarketStore.getState().clearMarketData();
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

});
