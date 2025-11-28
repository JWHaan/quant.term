import { describe, it, expect, beforeEach } from 'vitest';
import { useOrderBookHistoryStore, orderBookToSnapshot, OrderBookSnapshot } from '@/stores/orderBookHistoryStore';
import { OrderBook } from '@/hooks/useBinanceWebSocket';

describe('OrderBookHistoryStore', () => {
    beforeEach(() => {
        // Reset store before each test
        useOrderBookHistoryStore.getState().clearSnapshots();
    });

    describe('addSnapshot', () => {
        it('should add a snapshot to the store', () => {
            const store = useOrderBookHistoryStore.getState();
            // Set capture interval to a very small value to disable throttling for this test
            store.setCaptureInterval(1);
            // Reset lastCaptureTime to a value far in the past to ensure snapshot is not throttled
            useOrderBookHistoryStore.setState({ lastCaptureTime: Date.now() - 10000 });
            
            const snapshot: OrderBookSnapshot = {
                timestamp: Date.now(),
                bids: new Map([[100, 1.5]]),
                asks: new Map([[101, 2.0]]),
                symbol: 'BTCUSDT'
            };

            store.addSnapshot(snapshot);
            const finalState = useOrderBookHistoryStore.getState();
            expect(finalState.snapshots.length).toBe(1);
        });

        it('should maintain FIFO queue when exceeding maxSnapshots', () => {
            const store = useOrderBookHistoryStore.getState();
            store.setMaxSnapshots(3);

            // Add 5 snapshots
            for (let i = 0; i < 5; i++) {
                const snapshot: OrderBookSnapshot = {
                    timestamp: Date.now() + i * 1000,
                    bids: new Map([[100 + i, 1.0]]),
                    asks: new Map([[101 + i, 1.0]]),
                    symbol: 'BTCUSDT'
                };

                // Force capture by resetting lastCaptureTime
                useOrderBookHistoryStore.setState({ lastCaptureTime: 0 });
                store.addSnapshot(snapshot);
            }

            const snapshots = useOrderBookHistoryStore.getState().snapshots;
            expect(snapshots.length).toBe(3);
            // Should keep the last 3 snapshots
            const firstSnapshot = snapshots[0];
            expect(firstSnapshot).toBeDefined();
            if (firstSnapshot) {
                expect(firstSnapshot.bids.has(102)).toBe(true);
            }
        });

        it('should throttle snapshots based on captureInterval', () => {
            const store = useOrderBookHistoryStore.getState();
            store.setCaptureInterval(1000); // 1 second

            const snapshot1: OrderBookSnapshot = {
                timestamp: Date.now(),
                bids: new Map([[100, 1.0]]),
                asks: new Map([[101, 1.0]]),
                symbol: 'BTCUSDT'
            };

            const snapshot2: OrderBookSnapshot = {
                timestamp: Date.now() + 100, // 100ms later
                bids: new Map([[100, 2.0]]),
                asks: new Map([[101, 2.0]]),
                symbol: 'BTCUSDT'
            };

            store.addSnapshot(snapshot1);
            store.addSnapshot(snapshot2); // Should be throttled

            const snapshots = useOrderBookHistoryStore.getState().snapshots;
            expect(snapshots.length).toBe(1);
        });
    });

    describe('getSnapshotsInTimeRange', () => {
        it('should return snapshots within time range', () => {
            const store = useOrderBookHistoryStore.getState();
            const baseTime = Date.now();
            // Set a very small capture interval to allow all snapshots to be added
            store.setCaptureInterval(1);

            // Add snapshots at different times
            for (let i = 0; i < 5; i++) {
                const snapshot: OrderBookSnapshot = {
                    timestamp: baseTime + i * 10000, // 10 seconds apart
                    bids: new Map([[100, 1.0]]),
                    asks: new Map([[101, 1.0]]),
                    symbol: 'BTCUSDT'
                };

                // Reset lastCaptureTime before each add to avoid throttling
                useOrderBookHistoryStore.setState({ lastCaptureTime: 0 });
                store.addSnapshot(snapshot);
            }

            const filtered = store.getSnapshotsInTimeRange(
                baseTime + 15000,
                baseTime + 35000
            );

            // Snapshots at indices 1 (baseTime + 10000), 2 (baseTime + 20000), 3 (baseTime + 30000)
            // But wait, the range is baseTime + 15000 to baseTime + 35000
            // So it should include: baseTime + 20000 (i=2), baseTime + 30000 (i=3), baseTime + 40000 (i=4)
            // Actually wait, baseTime + 40000 is 40000, which is > 35000, so it should be excluded
            // So we should get: baseTime + 20000 (i=2) and baseTime + 30000 (i=3) = 2 snapshots
            // But the test expects 3. Let me check: baseTime + 15000 to baseTime + 35000
            // baseTime + 10000 (i=1) = 10000 < 15000, excluded
            // baseTime + 20000 (i=2) = 20000, included (>= 15000 and <= 35000)
            // baseTime + 30000 (i=3) = 30000, included
            // baseTime + 40000 (i=4) = 40000 > 35000, excluded
            // So we should get 2, not 3. The test expectation is wrong, or the range should be different.
            // Let me adjust the range to include 3 snapshots: baseTime + 10000 to baseTime + 40000
            expect(filtered.length).toBe(2); // Snapshots at 20s (i=2) and 30s (i=3)
        });
    });

    describe('orderBookToSnapshot', () => {
        it('should convert OrderBook to OrderBookSnapshot', () => {
            const orderBook: OrderBook = {
                bids: [
                    { price: 100, size: 1.5, total: 1.5 },
                    { price: 99, size: 2.0, total: 3.5 }
                ],
                asks: [
                    { price: 101, size: 1.0, total: 1.0 },
                    { price: 102, size: 1.5, total: 2.5 }
                ],
                lastUpdateId: 12345,
                timestamp: Date.now(),
                isStale: false
            };

            const snapshot = orderBookToSnapshot(orderBook, 'BTCUSDT');

            expect(snapshot.symbol).toBe('BTCUSDT');
            expect(snapshot.bids.size).toBe(2);
            expect(snapshot.asks.size).toBe(2);
            expect(snapshot.bids.get(100)).toBe(1.5);
            expect(snapshot.asks.get(101)).toBe(1.0);
        });

        it('should handle empty order book', () => {
            const orderBook: OrderBook = {
                bids: [],
                asks: [],
                lastUpdateId: 0,
                timestamp: Date.now(),
                isStale: false
            };

            const snapshot = orderBookToSnapshot(orderBook, 'BTCUSDT');

            expect(snapshot.bids.size).toBe(0);
            expect(snapshot.asks.size).toBe(0);
        });
    });
});

describe('Heatmap Data Binning', () => {
    it('should bin prices correctly', () => {
        const priceBinSize = 1;
        const prices = [100.1, 100.5, 100.9, 101.2, 101.8];

        const binned = prices.map(p => Math.floor(p / priceBinSize) * priceBinSize);

        expect(binned).toEqual([100, 100, 100, 101, 101]);
    });

    it('should bin times correctly', () => {
        const timeBinSeconds = 10;
        const timeBinMs = timeBinSeconds * 1000;

        const timestamps = [
            1000000000, // 0s
            1000005000, // 5s
            1000012000, // 12s
            1000018000, // 18s
            1000025000  // 25s
        ];

        const binned = timestamps.map(t => Math.floor(t / timeBinMs) * timeBinMs);

        expect(binned[0]).toBe(binned[1]); // 0s and 5s in same bin
        expect(binned[2]).toBe(binned[3]); // 12s and 18s in same bin
        expect(binned[2]).not.toBe(binned[0]); // Different bins
    });

    it('should aggregate sizes within bins', () => {
        const data = [
            { price: 100.1, size: 1.0 },
            { price: 100.5, size: 2.0 },
            { price: 100.9, size: 1.5 },
            { price: 101.2, size: 3.0 }
        ];

        const priceBinSize = 1;
        const aggregated = new Map<number, number>();

        data.forEach(({ price, size }) => {
            const bin = Math.floor(price / priceBinSize) * priceBinSize;
            aggregated.set(bin, (aggregated.get(bin) || 0) + size);
        });

        expect(aggregated.get(100)).toBe(4.5); // 1.0 + 2.0 + 1.5
        expect(aggregated.get(101)).toBe(3.0);
    });
});

describe('Performance Tests', () => {
    it('should process 300 snapshots in under 50ms', () => {
        const store = useOrderBookHistoryStore.getState();
        store.setMaxSnapshots(300);

        const startTime = performance.now();

        // Add 300 snapshots
        for (let i = 0; i < 300; i++) {
            const snapshot: OrderBookSnapshot = {
                timestamp: Date.now() + i * 1000,
                bids: new Map(Array.from({ length: 20 }, (_, j) => [100 - j, Math.random() * 10])),
                asks: new Map(Array.from({ length: 20 }, (_, j) => [101 + j, Math.random() * 10])),
                symbol: 'BTCUSDT'
            };

            useOrderBookHistoryStore.setState({ lastCaptureTime: 0 });
            store.addSnapshot(snapshot);
        }

        const endTime = performance.now();
        const duration = endTime - startTime;

        expect(duration).toBeLessThan(50);
    });
});
