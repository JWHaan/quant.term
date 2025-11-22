import { useState, useEffect, useRef } from 'react';

/**
 * Hook to fetch real-time order book data
 * Uses Binance @depth20 stream for high-speed updates (100ms)
 * @param {string} symbol - Trading pair (e.g., 'BTCUSDT')
 */
export const useOrderBook = (symbol = 'BTCUSDT') => {
    const [bids, setBids] = useState([]);
    const [asks, setAsks] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    const wsRef = useRef(null);

    useEffect(() => {
        if (!symbol) return;

        const wsSymbol = symbol.toLowerCase();
        const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${wsSymbol}@depth20@100ms`);
        wsRef.current = ws;

        ws.onopen = () => {
            setIsConnected(true);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                // Binance @depth20 stream returns arrays of [price, quantity]
                setBids(data.bids);
                setAsks(data.asks);
            } catch (err) {
                console.error("OrderBook Parse Error:", err);
            }
        };

        ws.onclose = () => {
            setIsConnected(false);
        };

        return () => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        };
    }, [symbol]);

    return { bids, asks, isConnected };
};
