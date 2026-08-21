import { useEffect, useRef, useState } from 'react';
import { BINANCE_WS_URL } from '@/constants/config';
import {
    recordLiveMarketEvent,
    releaseLiveConnection,
    reportLiveConnection,
} from '@/services/marketTelemetry';

const MAX_RECONNECT_DELAY_MS = 30_000;
const STALE_AFTER_MS = 10_000;

export type OrderBookLevel = [price: string, quantity: string];

interface BookSnapshot {
    symbol: string | null;
    bids: OrderBookLevel[];
    asks: OrderBookLevel[];
}

interface ConnectionState {
    symbol: string | null;
    connected: boolean;
}

interface UseOrderBookResult {
    bids: OrderBookLevel[];
    asks: OrderBookLevel[];
    isConnected: boolean;
}

interface BinanceDepthSnapshot {
    E?: number;
    bids: OrderBookLevel[];
    asks: OrderBookLevel[];
}

const isOrderBookLevel = (value: unknown): value is OrderBookLevel => (
    Array.isArray(value)
    && value.length >= 2
    && typeof value[0] === 'string'
    && typeof value[1] === 'string'
);

const isDepthSnapshot = (value: unknown): value is BinanceDepthSnapshot => {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Record<string, unknown>;
    return Array.isArray(candidate.bids)
        && candidate.bids.every(isOrderBookLevel)
        && Array.isArray(candidate.asks)
        && candidate.asks.every(isOrderBookLevel)
        && (candidate.E === undefined || typeof candidate.E === 'number');
};

/**
 * Live top-20 Binance order-book snapshots. The partial-depth stream already
 * sends complete sorted snapshots, so no diff-book reconciliation is needed.
 */
export const useOrderBook = (symbol = 'BTCUSDT'): UseOrderBookResult => {
    const normalizedSymbol = symbol.toUpperCase();
    const [book, setBook] = useState<BookSnapshot>({ symbol: null, bids: [], asks: [] });
    const [connection, setConnection] = useState<ConnectionState>({
        symbol: null,
        connected: false,
    });
    const wsRef = useRef<WebSocket | null>(null);
    const ownerRef = useRef<object>({});

    useEffect(() => {
        if (!normalizedSymbol) return undefined;

        const connectionOwner = ownerRef.current;
        let disposed = false;
        let reconnectAttempts = 0;
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
        let lastMessageAt = 0;

        const scheduleReconnect = (connect: () => void): void => {
            if (disposed || reconnectTimer) return;
            const delay = Math.min(MAX_RECONNECT_DELAY_MS, 1_000 * (2 ** reconnectAttempts));
            reconnectAttempts += 1;
            reportLiveConnection('depth', connectionOwner, 'reconnecting');
            reconnectTimer = setTimeout(() => {
                reconnectTimer = null;
                connect();
            }, delay);
        };

        const connect = (): void => {
            if (disposed) return;
            reportLiveConnection(
                'depth',
                connectionOwner,
                reconnectAttempts > 0 ? 'reconnecting' : 'connecting',
            );

            const wsSymbol = normalizedSymbol.toLowerCase();
            const ws = new WebSocket(`${BINANCE_WS_URL}/ws/${wsSymbol}@depth20@100ms`);
            wsRef.current = ws;

            ws.onopen = () => {
                if (disposed || wsRef.current !== ws) return;
                reconnectAttempts = 0;
                lastMessageAt = Date.now();
                setConnection({ symbol: normalizedSymbol, connected: true });
                reportLiveConnection('depth', connectionOwner, 'connected');
            };

            ws.onmessage = (event) => {
                if (disposed || wsRef.current !== ws || typeof event.data !== 'string') return;
                try {
                    const data: unknown = JSON.parse(event.data);
                    if (!isDepthSnapshot(data)) return;

                    lastMessageAt = Date.now();
                    setBook({
                        symbol: normalizedSymbol,
                        bids: data.bids,
                        asks: data.asks,
                    });
                    recordLiveMarketEvent('binance', data.E, normalizedSymbol);
                } catch (error) {
                    console.error('[Binance depth] Failed to parse snapshot:', error);
                }
            };

            ws.onerror = () => {
                if (disposed || wsRef.current !== ws) return;
                setConnection({ symbol: normalizedSymbol, connected: false });
                reportLiveConnection('depth', connectionOwner, 'error');
                ws.close();
            };

            ws.onclose = () => {
                if (disposed || wsRef.current !== ws) return;
                setConnection({ symbol: normalizedSymbol, connected: false });
                scheduleReconnect(connect);
            };
        };

        connect();

        const watchdog = setInterval(() => {
            const ws = wsRef.current;
            if (
                !disposed
                && ws?.readyState === WebSocket.OPEN
                && lastMessageAt > 0
                && Date.now() - lastMessageAt > STALE_AFTER_MS
            ) {
                ws.close();
            }
        }, 1_000);

        return () => {
            disposed = true;
            clearInterval(watchdog);
            if (reconnectTimer) clearTimeout(reconnectTimer);

            const ws = wsRef.current;
            if (ws) {
                ws.onopen = null;
                ws.onmessage = null;
                ws.onerror = null;
                ws.onclose = null;
                if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                    ws.close();
                }
            }
            if (wsRef.current === ws) wsRef.current = null;
            releaseLiveConnection('depth', connectionOwner);
        };
    }, [normalizedSymbol]);

    const isCurrentBook = book.symbol === normalizedSymbol;
    return {
        bids: isCurrentBook ? book.bids : [],
        asks: isCurrentBook ? book.asks : [],
        isConnected: connection.symbol === normalizedSymbol && connection.connected,
    };
};
