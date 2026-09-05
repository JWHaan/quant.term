import { create } from 'zustand';
import type { DepthBook } from '@/hooks/useDepthStream';

export interface OrderBookSnapshot {
    timestamp: number;
    bids: Map<number, number>; // price -> size
    asks: Map<number, number>; // price -> size
    symbol: string;
}

interface OrderBookHistoryState {
    snapshots: OrderBookSnapshot[];
    maxSnapshots: number;
    captureInterval: number; // milliseconds
    lastCaptureTime: number;

    // Actions
    addSnapshot: (snapshot: OrderBookSnapshot) => void;
    clearSnapshots: () => void;
    getSnapshotsInTimeRange: (startTime: number, endTime: number) => OrderBookSnapshot[];
    setMaxSnapshots: (max: number) => void;
    setCaptureInterval: (interval: number) => void;
}

export const useOrderBookHistoryStore = create<OrderBookHistoryState>((set, get) => ({
    snapshots: [],
    maxSnapshots: 300, // 5 minutes at 1 snapshot/second
    captureInterval: 1000, // 1 second
    lastCaptureTime: 0,

    addSnapshot: (snapshot: OrderBookSnapshot) => {
        const state = get();
        const now = Date.now();

        // Throttle captures based on interval
        if (now - state.lastCaptureTime < state.captureInterval) {
            return;
        }

        set((state) => {
            const newSnapshots = [...state.snapshots, snapshot];

            // FIFO: Remove oldest if exceeding max
            if (newSnapshots.length > state.maxSnapshots) {
                newSnapshots.shift();
            }

            return {
                snapshots: newSnapshots,
                lastCaptureTime: now
            };
        });
    },

    clearSnapshots: () => set({ snapshots: [], lastCaptureTime: 0 }),

    getSnapshotsInTimeRange: (startTime: number, endTime: number) => {
        const state = get();
        return state.snapshots.filter(
            s => s.timestamp >= startTime && s.timestamp <= endTime
        );
    },

    setMaxSnapshots: (max: number) => set({ maxSnapshots: max }),

    setCaptureInterval: (interval: number) => set({ captureInterval: interval }),
}));

// Helper function to convert DepthBook to OrderBookSnapshot
export const orderBookToSnapshot = (
    orderBook: DepthBook,
    symbol: string
): OrderBookSnapshot => {
    const bids = new Map<number, number>();
    const asks = new Map<number, number>();

    orderBook.bids.forEach(level => {
        bids.set(level.price, level.quantity);
    });

    orderBook.asks.forEach(level => {
        asks.set(level.price, level.quantity);
    });

    return {
        timestamp: orderBook.receivedAt || Date.now(),
        bids,
        asks,
        symbol
    };
};
