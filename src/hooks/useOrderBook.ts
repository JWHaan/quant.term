import { useMemo } from 'react';
import { useDepthStream } from '@/hooks/useDepthStream';
import type { DepthBookLevel } from '@/hooks/useDepthStream';

export type OrderBookLevel = DepthBookLevel;

interface UseOrderBookResult {
    bids: OrderBookLevel[];
    asks: OrderBookLevel[];
    isConnected: boolean;
}

/**
 * Live top-20 Binance order-book snapshots backed by the shared per-symbol
 * depth feed. The partial-depth stream already sends complete sorted
 * snapshots, so no diff-book reconciliation is needed.
 */
export const useOrderBook = (symbol = 'BTCUSDT'): UseOrderBookResult => {
    const { book, isConnected } = useDepthStream(symbol);

    const bids = useMemo(() => book?.bids ?? [], [book]);
    const asks = useMemo(() => book?.asks ?? [], [book]);

    return { bids, asks, isConnected };
};
