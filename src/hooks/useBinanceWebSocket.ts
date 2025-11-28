import { useState, useEffect, useRef, useCallback } from 'react';

// HTTP endpoint for market data
const BINANCE_REST_URL = 'https://api.binance.com';
const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws';

export interface Candle {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface Trade {
    id: number;
    time: string;
    price: number;
    size: number;
    side: 'BUY' | 'SELL';
    symbol: string;
}

export interface OrderBookLevel {
    price: number;
    size: number;
    total?: number; // Cumulative size
}

export interface OrderBook {
    bids: OrderBookLevel[];
    asks: OrderBookLevel[];
    lastUpdateId: number;
    timestamp: number;
    isStale: boolean; // Data older than 2 seconds
}

interface UseBinanceWebSocketReturn {
    trades: Trade[];
    candle: Candle | null;
    orderBook: OrderBook | null;
    isConnected: boolean;
    lastUpdate: number; // Timestamp of last successful update
    reconnectCount: number;
}

// Aggregate order book levels by tick size to reduce noise
const aggregateOrderBook = (levels: [string, string][], tickSize: number = 0.01): OrderBookLevel[] => {
    const aggregated = new Map<number, number>();

    levels.forEach(([price, size]) => {
        const p = parseFloat(price);
        const s = parseFloat(size);

        // Round to tick size
        const roundedPrice = Math.round(p / tickSize) * tickSize;

        aggregated.set(roundedPrice, (aggregated.get(roundedPrice) || 0) + s);
    });

    // Convert to array and calculate cumulative totals
    const result: OrderBookLevel[] = [];
    let cumulative = 0;

    Array.from(aggregated.entries())
        .sort((a, b) => b[0] - a[0]) // Sort descending for bids, will reverse for asks
        .forEach(([price, size]) => {
            cumulative += size;
            result.push({ price, size, total: cumulative });
        });

    return result;
};

// Filter outliers (potential spoofing)
const filterOutliers = (levels: OrderBookLevel[], threshold: number = 10): OrderBookLevel[] => {
    if (levels.length === 0) return levels;

    const avgSize = levels.reduce((sum, l) => sum + l.size, 0) / levels.length;
    const maxSize = avgSize * threshold;

    return levels.filter(l => l.size <= maxSize);
};

export const useBinanceWebSocket = (
    symbol: string = 'btcusdt',
    interval: string = '1m'
): UseBinanceWebSocketReturn => {
    const [trades, setTrades] = useState<Trade[]>([]);
    const [candle, setCandle] = useState<Candle | null>(null);
    const [orderBook, setOrderBook] = useState<OrderBook | null>(null);
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
    const [reconnectCount, setReconnectCount] = useState<number>(0);

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const pollRef = useRef<NodeJS.Timeout | null>(null);
    const reconcileRef = useRef<NodeJS.Timeout | null>(null);
    const orderBookBufferRef = useRef<any[]>([]);
    const lastUpdateIdRef = useRef<number>(0);

    // Fetch full order book snapshot for reconciliation
    const fetchOrderBookSnapshot = useCallback(async (sym: string) => {
        try {
            const res = await fetch(
                `${BINANCE_REST_URL}/api/v3/depth?symbol=${sym.toUpperCase()}&limit=100`
            );
            const data = await res.json();

            if (data.lastUpdateId) {
                const bids = aggregateOrderBook(data.bids);
                const asks = aggregateOrderBook(data.asks);

                // Filter outliers
                const filteredBids = filterOutliers(bids);
                const filteredAsks = filterOutliers(asks);

                setOrderBook({
                    bids: filteredBids.slice(0, 20), // Top 20 levels
                    asks: filteredAsks.slice(0, 20),
                    lastUpdateId: data.lastUpdateId,
                    timestamp: Date.now(),
                    isStale: false
                });

                lastUpdateIdRef.current = data.lastUpdateId;
                setLastUpdate(Date.now());
            }
        } catch (e) {
            console.error('Failed to fetch order book snapshot:', e);
        }
    }, []);

    // Process buffered order book updates
    const processOrderBookBuffer = useCallback(() => {
        if (orderBookBufferRef.current.length === 0) return;

        const updates = orderBookBufferRef.current;
        orderBookBufferRef.current = [];

        // Apply updates (simplified - in production, merge with existing book)
        const latestUpdate = updates[updates.length - 1];

        if (latestUpdate && latestUpdate.u > lastUpdateIdRef.current) {
            const bids = aggregateOrderBook(latestUpdate.b || []);
            const asks = aggregateOrderBook(latestUpdate.a || []);

            const filteredBids = filterOutliers(bids);
            const filteredAsks = filterOutliers(asks);

            setOrderBook(prev => ({
                bids: filteredBids.slice(0, 20),
                asks: filteredAsks.slice(0, 20),
                lastUpdateId: latestUpdate.u,
                timestamp: Date.now(),
                isStale: prev ? (Date.now() - prev.timestamp > 2000) : false
            }));

            lastUpdateIdRef.current = latestUpdate.u;
            setLastUpdate(Date.now());
        }
    }, []);

    useEffect(() => {
        const sym = symbol.toLowerCase();

        // Establish WebSocket connection
        const connectWebSocket = () => {
            try {
                const ws = new WebSocket(
                    `${BINANCE_WS_URL}/${sym}@kline_${interval}/${sym}@trade/${sym}@depth@100ms`
                );

                ws.onopen = () => {
                    console.log('WebSocket connected');
                    setIsConnected(true);
                    setReconnectCount(prev => prev + 1);

                    // Fetch initial snapshot
                    fetchOrderBookSnapshot(sym);
                };

                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);

                        // Handle kline updates
                        if (data.e === 'kline') {
                            const k = data.k;
                            setCandle({
                                time: k.t / 1000,
                                open: parseFloat(k.o),
                                high: parseFloat(k.h),
                                low: parseFloat(k.l),
                                close: parseFloat(k.c),
                                volume: parseFloat(k.v),
                            });
                            setLastUpdate(Date.now());
                        }

                        // Handle trade updates
                        if (data.e === 'trade') {
                            const newTrade: Trade = {
                                id: data.t,
                                time: new Date(data.T).toLocaleTimeString(),
                                price: parseFloat(data.p),
                                size: parseFloat(data.q),
                                side: data.m ? 'SELL' : 'BUY',
                                symbol: data.s,
                            };

                            setTrades(prev => [newTrade, ...prev].slice(0, 50));
                            setLastUpdate(Date.now());
                        }

                        // Handle order book depth updates
                        if (data.e === 'depthUpdate') {
                            orderBookBufferRef.current.push(data);
                        }
                    } catch (e) {
                        console.error('Failed to parse WebSocket message:', e);
                    }
                };

                ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    setIsConnected(false);
                };

                ws.onclose = () => {
                    console.log('WebSocket closed, reconnecting...');
                    setIsConnected(false);

                    // Mark data as stale
                    setOrderBook(prev => prev ? { ...prev, isStale: true } : null);

                    // Attempt reconnection after 3 seconds
                    if (reconnectTimeoutRef.current) {
                        clearTimeout(reconnectTimeoutRef.current);
                    }
                    reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
                };

                wsRef.current = ws;
            } catch (e) {
                console.error('Failed to connect WebSocket:', e);
                setIsConnected(false);
            }
        };

        // Start WebSocket connection
        connectWebSocket();

        // Periodic snapshot reconciliation (every 10 seconds)
        reconcileRef.current = setInterval(() => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                fetchOrderBookSnapshot(sym);
            }
        }, 10000);

        // Batch process order book updates (every 100ms)
        pollRef.current = setInterval(processOrderBookBuffer, 100);

        // Cleanup
        return () => {
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
            if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            }
            if (reconcileRef.current) {
                clearInterval(reconcileRef.current);
                reconcileRef.current = null;
            }
        };
    }, [symbol, interval, fetchOrderBookSnapshot, processOrderBookBuffer]);

    return {
        trades,
        candle,
        orderBook,
        isConnected,
        lastUpdate,
        reconnectCount
    };
};
