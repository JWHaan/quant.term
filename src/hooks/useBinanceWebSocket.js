import { useState, useEffect, useRef, useCallback } from 'react';

const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws';

export const useBinanceWebSocket = (symbol = 'btcusdt', interval = '1m') => {
    const [trades, setTrades] = useState([]);
    const [candle, setCandle] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const wsRef = useRef(null);

    const currentCandleRef = useRef(null);

    useEffect(() => {
        const wsSymbol = symbol.toLowerCase();
        const ws = new WebSocket(`${BINANCE_WS_URL}/stream?streams=${wsSymbol}@trade/${wsSymbol}@kline_${interval}`);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log(`Connected to Binance WebSocket (${interval})`);
            setIsConnected(true);
        };

        ws.onmessage = (event) => {
            const wrapper = JSON.parse(event.data);
            const message = wrapper.data;

            // Handle Kline (Candle) Data - Source of Truth
            if (message && message.e === 'kline') {
                const k = message.k;
                const newCandle = {
                    time: k.t / 1000,
                    open: parseFloat(k.o),
                    high: parseFloat(k.h),
                    low: parseFloat(k.l),
                    close: parseFloat(k.c),
                    volume: parseFloat(k.v)
                };
                currentCandleRef.current = newCandle;
                setCandle(newCandle);
            }

            // Handle Trade Data - Real-time Updates
            if (message && message.e === 'trade') {
                const price = parseFloat(message.p);
                const qty = parseFloat(message.q);

                const trade = {
                    id: message.t,
                    time: new Date(message.T).toLocaleTimeString(),
                    price: price,
                    size: qty,
                    side: message.m ? 'SELL' : 'BUY',
                    symbol: message.s
                };
                setTrades(prev => [trade, ...prev].slice(0, 50));

                // Optimistic Candle Update
                if (currentCandleRef.current) {
                    const c = currentCandleRef.current;
                    // Only update if trade is within or after the current candle time
                    // (Simple check: ensure we don't update a closed candle if kline stream lags)
                    // Actually, for live charting, we just want to update the "latest" candle we have.

                    const updatedCandle = {
                        ...c,
                        close: price,
                        high: Math.max(c.high, price),
                        low: Math.min(c.low, price),
                        volume: c.volume + qty
                    };

                    currentCandleRef.current = updatedCandle;
                    setCandle(updatedCandle);
                }
            }
        };

        ws.onclose = () => {
            console.log('Disconnected from Binance WebSocket');
            setIsConnected(false);
        };

        ws.onerror = (error) => {
            console.error('WebSocket Error:', error);
        };

        return () => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        };
    }, [symbol, interval]);

    return { trades, candle, isConnected };
};
