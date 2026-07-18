import { useEffect, useRef, useState } from 'react';
import {
    recordLiveMarketEvent,
    releaseLiveConnection,
    reportLiveConnection,
} from '@/services/liveMarketData';
import { BINANCE_WS_URL } from '@/constants/config';

const MAX_RECONNECT_DELAY_MS = 30_000;
const STALE_AFTER_MS = 10_000;

/**
 * Live top-20 Binance order book snapshots. The partial-depth stream already
 * sends complete sorted snapshots, so no diff-book reconciliation is needed.
 */
export const useOrderBook = (symbol = 'BTCUSDT') => {
    const normalizedSymbol = symbol.toUpperCase();
    const [book, setBook] = useState({ symbol: null, bids: [], asks: [] });
    const [connection, setConnection] = useState({ symbol: null, connected: false });
    const wsRef = useRef(null);
    const ownerRef = useRef({});

    useEffect(() => {
        if (!normalizedSymbol) return undefined;

        let disposed = false;
        let reconnectAttempts = 0;
        let reconnectTimer = null;
        let lastMessageAt = 0;

        const scheduleReconnect = (connect) => {
            if (disposed || reconnectTimer) return;
            const delay = Math.min(MAX_RECONNECT_DELAY_MS, 1_000 * (2 ** reconnectAttempts));
            reconnectAttempts += 1;
            reportLiveConnection('depth', ownerRef.current, 'reconnecting');
            reconnectTimer = setTimeout(() => {
                reconnectTimer = null;
                connect();
            }, delay);
        };

        const connect = () => {
            if (disposed) return;
            reportLiveConnection(
                'depth',
                ownerRef.current,
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
                reportLiveConnection('depth', ownerRef.current, 'connected');
            };

            ws.onmessage = (event) => {
                if (disposed || wsRef.current !== ws) return;
                try {
                    const data = JSON.parse(event.data);
                    if (!Array.isArray(data?.bids) || !Array.isArray(data?.asks)) return;

                    lastMessageAt = Date.now();
                    setBook({
                        symbol: normalizedSymbol,
                        bids: data.bids,
                        asks: data.asks,
                    });
                    recordLiveMarketEvent(
                        'binance',
                        typeof data.E === 'number' ? data.E : undefined,
                        normalizedSymbol,
                    );
                } catch (error) {
                    console.error('[Binance depth] Failed to parse snapshot:', error);
                }
            };

            ws.onerror = () => {
                if (disposed || wsRef.current !== ws) return;
                setConnection({ symbol: normalizedSymbol, connected: false });
                reportLiveConnection('depth', ownerRef.current, 'error');
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
                !disposed &&
                ws?.readyState === WebSocket.OPEN &&
                lastMessageAt > 0 &&
                Date.now() - lastMessageAt > STALE_AFTER_MS
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
            releaseLiveConnection('depth', ownerRef.current);
        };
    }, [normalizedSymbol]);

    const isCurrentBook = book.symbol === normalizedSymbol;
    return {
        bids: isCurrentBook ? book.bids : [],
        asks: isCurrentBook ? book.asks : [],
        isConnected: connection.symbol === normalizedSymbol && connection.connected,
    };
};
