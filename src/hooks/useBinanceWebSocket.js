import { useState, useEffect, useRef } from 'react';

// HTTP endpoint for market data (works even when WebSockets are blocked)
const BINANCE_REST_URL = 'https://api.binance.com';

export const useBinanceWebSocket = (symbol = 'btcusdt', interval = '1m') => {
    const [trades, setTrades] = useState([]);
    const [candle, setCandle] = useState(null);
    const [isConnected, setIsConnected] = useState(false);

    const pollRef = useRef(null);

    useEffect(() => {
        const sym = symbol.toUpperCase();

        const fetchLatest = async () => {
            try {
                // Latest kline for the selected interval
                const res = await fetch(
                    `${BINANCE_REST_URL}/api/v3/klines?symbol=${sym}&interval=${interval}&limit=2`,
                );
                const data = await res.json();
                if (!Array.isArray(data) || data.length === 0) return;

                const k = data[data.length - 1];
                const newCandle = {
                    time: k[0] / 1000,
                    open: parseFloat(k[1]),
                    high: parseFloat(k[2]),
                    low: parseFloat(k[3]),
                    close: parseFloat(k[4]),
                    volume: parseFloat(k[5]),
                };
                setCandle(newCandle);
                setIsConnected(true);

                // Optional: fetch last trades snapshot for tape-style panels
                try {
                    const tradesRes = await fetch(
                        `${BINANCE_REST_URL}/api/v3/trades?symbol=${sym}&limit=50`,
                    );
                    const tradesJson = await tradesRes.json();
                    if (Array.isArray(tradesJson)) {
                        const mappedTrades = tradesJson.map((t) => ({
                            id: t.id,
                            time: new Date(t.time).toLocaleTimeString(),
                            price: parseFloat(t.price),
                            size: parseFloat(t.qty),
                            side: t.isBuyerMaker ? 'SELL' : 'BUY',
                            symbol: sym,
                        }));
                        setTrades(mappedTrades);
                    }
                } catch {
                    // Ignore trade fetch errors; candle data is primary
                }
            } catch (e) {
                console.error('Failed to fetch REST market data:', e);
                setIsConnected(false);
            }
        };

        // Initial fetch
        fetchLatest();

        // Poll every 3 seconds for near-real-time updates
        pollRef.current = setInterval(fetchLatest, 3000);

        return () => {
            if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            }
        };
    }, [symbol, interval]);

    return { trades, candle, isConnected };
};
