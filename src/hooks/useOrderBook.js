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
    const currentSymbolRef = useRef(symbol);

    useEffect(() => {
        if (!symbol) return;

        // Update the current symbol ref
        currentSymbolRef.current = symbol;

        const wsSymbol = symbol.toLowerCase();
        const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${wsSymbol}@depth20@100ms`);
        wsRef.current = ws;

        ws.onopen = () => {
            // Only update connection status if this is still the current symbol
            if (currentSymbolRef.current === symbol) {
                setIsConnected(true);
            }
        };

        ws.onmessage = (event) => {
            try {
                // Only update state if this WebSocket is for the current symbol
                if (currentSymbolRef.current !== symbol) {
                    return;
                }

                const data = JSON.parse(event.data);
                // Binance @depth20 stream returns arrays of [price, quantity]
                setBids(data.bids || []);
                setAsks(data.asks || []);
            } catch (err) {
                console.error("OrderBook Parse Error:", err);
            }
        };

        ws.onclose = () => {
            // Only update connection status if this is still the current symbol
            if (currentSymbolRef.current === symbol) {
                setIsConnected(false);
            }
        };

        ws.onerror = (error) => {
            console.error("OrderBook WebSocket Error:", error);
            if (currentSymbolRef.current === symbol) {
                setIsConnected(false);
            }
        };

        return () => {
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close();
            }
        };
    }, [symbol]);

    return { bids, asks, isConnected };
};
