import { useEffect, useRef, useState } from 'react';
import { BINANCE_WS_URL } from '@/constants/config';
import {
    recordLiveMarketEvent,
    releaseLiveConnection,
    reportLiveConnection,
} from '@/services/liveMarketData';
import { provenanceRegistry } from '@/services/provenanceEngine';
import { useMarketStore } from '@/stores/marketStore';

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
    total?: number;
}

export interface OrderBook {
    bids: OrderBookLevel[];
    asks: OrderBookLevel[];
    lastUpdateId: number;
    timestamp: number;
    isStale: boolean;
}

interface UseBinanceWebSocketReturn {
    trades: Trade[];
    candle: Candle | null;
    orderBook: OrderBook | null;
    isConnected: boolean;
    lastUpdate: number;
    reconnectCount: number;
}

interface KeyedValue<T> {
    key: string;
    value: T;
}

type JsonRecord = Record<string, unknown>;

const MAX_RECONNECT_DELAY_MS = 30_000;
const STALE_BOOK_AFTER_MS = 2_000;
const STALE_SOCKET_AFTER_MS = 15_000;

const asRecord = (value: unknown): JsonRecord | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as JsonRecord;
};

const asFiniteNumber = (value: unknown): number | null => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const parsePriceLevels = (value: unknown, side: 'bid' | 'ask'): OrderBookLevel[] => {
    if (!Array.isArray(value)) return [];

    const levels: Array<{ price: number; size: number }> = [];
    value.forEach((row) => {
        if (!Array.isArray(row) || row.length < 2) return;
        const price = asFiniteNumber(row[0]);
        const size = asFiniteNumber(row[1]);
        if (price === null || size === null || price <= 0 || size <= 0) return;
        levels.push({ price, size });
    });

    levels.sort((a, b) => side === 'bid' ? b.price - a.price : a.price - b.price);

    let cumulative = 0;
    return levels.slice(0, 20).map((level) => {
        cumulative += level.size;
        return { ...level, total: cumulative };
    });
};

const extractPayload = (raw: unknown): { stream: string | null; data: JsonRecord | null } => {
    const envelope = asRecord(raw);
    if (!envelope) return { stream: null, data: null };

    // Combined streams wrap payloads in { stream, data }. Accepting a raw
    // object as well keeps the parser resilient to server-side subscriptions.
    const wrappedData = asRecord(envelope['data']);
    return {
        stream: typeof envelope['stream'] === 'string' ? envelope['stream'] : null,
        data: wrappedData ?? envelope,
    };
};

export const useBinanceWebSocket = (
    symbol: string = 'btcusdt',
    interval: string = '1m',
): UseBinanceWebSocketReturn => {
    const normalizedSymbol = symbol.toUpperCase();
    const streamSymbol = normalizedSymbol.toLowerCase();
    const feedKey = `${normalizedSymbol}:${interval}`;

    const [tradesState, setTradesState] = useState<KeyedValue<Trade[]>>({ key: '', value: [] });
    const [candleState, setCandleState] = useState<KeyedValue<Candle | null>>({ key: '', value: null });
    const [orderBookState, setOrderBookState] = useState<KeyedValue<OrderBook | null>>({ key: '', value: null });
    const [connectionState, setConnectionState] = useState<KeyedValue<boolean>>({ key: '', value: false });
    const [lastUpdateState, setLastUpdateState] = useState<KeyedValue<number>>({ key: '', value: 0 });
    const [reconnectState, setReconnectState] = useState<KeyedValue<number>>({ key: '', value: 0 });

    const wsRef = useRef<WebSocket | null>(null);
    const ownerRef = useRef<object>({});
    const lastStoredTradeAtRef = useRef(0);

    useEffect(() => {
        let disposed = false;
        let reconnectAttempts = 0;
        let hasOpened = false;
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
        let lastMessageAt = 0;
        const owner = ownerRef.current;

        const sources = ['binance', 'depth', 'trades'] as const;
        const reportAll = (status: 'connecting' | 'connected' | 'error' | 'reconnecting') => {
            sources.forEach((source) => reportLiveConnection(source, owner, status));
        };

        const scheduleReconnect = (connect: () => void) => {
            if (disposed || reconnectTimer) return;
            const delay = Math.min(MAX_RECONNECT_DELAY_MS, 1_000 * (2 ** reconnectAttempts));
            reconnectAttempts += 1;
            reportAll('reconnecting');
            reconnectTimer = setTimeout(() => {
                reconnectTimer = null;
                connect();
            }, delay);
        };

        const connect = () => {
            if (disposed) return;

            reportAll(reconnectAttempts > 0 ? 'reconnecting' : 'connecting');
            const streams = [
                `${streamSymbol}@kline_${interval}`,
                `${streamSymbol}@trade`,
                `${streamSymbol}@depth20@100ms`,
            ].join('/');
            const ws = new WebSocket(`${BINANCE_WS_URL}/stream?streams=${streams}`);
            wsRef.current = ws;

            ws.onopen = () => {
                if (disposed || wsRef.current !== ws) return;
                lastMessageAt = Date.now();
                reconnectAttempts = 0;
                setConnectionState({ key: feedKey, value: true });
                reportAll('connected');

                if (hasOpened) {
                    setReconnectState((previous) => ({
                        key: feedKey,
                        value: previous.key === feedKey ? previous.value + 1 : 1,
                    }));
                } else {
                    hasOpened = true;
                    setReconnectState({ key: feedKey, value: 0 });
                }
            };

            ws.onmessage = (event: MessageEvent<string>) => {
                if (disposed || wsRef.current !== ws) return;

                try {
                    const parsed: unknown = JSON.parse(event.data);
                    const { stream, data } = extractPayload(parsed);
                    if (!data) return;

                    const receivedAt = Date.now();
                    lastMessageAt = receivedAt;
                    setLastUpdateState({ key: feedKey, value: receivedAt });

                    const eventTimestamp =
                        asFiniteNumber(data['E']) ??
                        asFiniteNumber(data['T']) ??
                        undefined;
                    recordLiveMarketEvent('binance', eventTimestamp, normalizedSymbol);

                    if (data['e'] === 'kline' || stream?.includes('@kline_')) {
                        const kline = asRecord(data['k']);
                        if (!kline) return;
                        const time = asFiniteNumber(kline['t']);
                        const open = asFiniteNumber(kline['o']);
                        const high = asFiniteNumber(kline['h']);
                        const low = asFiniteNumber(kline['l']);
                        const close = asFiniteNumber(kline['c']);
                        const volume = asFiniteNumber(kline['v']);
                        if ([time, open, high, low, close, volume].some((value) => value === null)) return;

                        const nextCandle: Candle = {
                            time: time! / 1000,
                            open: open!,
                            high: high!,
                            low: low!,
                            close: close!,
                            volume: volume!,
                        };
                        setCandleState({ key: feedKey, value: nextCandle });
                        provenanceRegistry
                            .getEngine(normalizedSymbol)
                            .augment(nextCandle, eventTimestamp ?? receivedAt);

                        if (kline['x'] === true) {
                            useMarketStore.getState().addCandle(normalizedSymbol, nextCandle);
                        }
                        return;
                    }

                    if (data['e'] === 'trade' || stream?.endsWith('@trade')) {
                        const id = asFiniteNumber(data['t']);
                        const tradeTime = asFiniteNumber(data['T']);
                        const price = asFiniteNumber(data['p']);
                        const size = asFiniteNumber(data['q']);
                        const tradeSymbol = typeof data['s'] === 'string' ? data['s'] : normalizedSymbol;
                        if (id === null || tradeTime === null || price === null || size === null) return;

                        const nextTrade: Trade = {
                            id,
                            time: new Date(tradeTime).toLocaleTimeString(),
                            price,
                            size,
                            side: data['m'] === true ? 'SELL' : 'BUY',
                            symbol: tradeSymbol,
                        };
                        setTradesState((previous) => ({
                            key: feedKey,
                            value: previous.key === feedKey
                                ? [nextTrade, ...previous.value].slice(0, 50)
                                : [nextTrade],
                        }));

                        // Keep the legacy global cache useful without copying its
                        // 10k-item buffer for every high-frequency trade message.
                        if (receivedAt - lastStoredTradeAtRef.current >= 250) {
                            lastStoredTradeAtRef.current = receivedAt;
                            useMarketStore.getState().addTrade(normalizedSymbol, nextTrade);
                        }
                        return;
                    }

                    const isPartialDepth =
                        stream?.includes('@depth20') ||
                        (Array.isArray(data['bids']) && Array.isArray(data['asks']));
                    if (isPartialDepth) {
                        const bids = parsePriceLevels(data['bids'], 'bid');
                        const asks = parsePriceLevels(data['asks'], 'ask');
                        if (bids.length === 0 || asks.length === 0) return;

                        setOrderBookState({
                            key: feedKey,
                            value: {
                                bids,
                                asks,
                                lastUpdateId: asFiniteNumber(data['lastUpdateId']) ?? 0,
                                timestamp: receivedAt,
                                isStale: false,
                            },
                        });
                    }
                } catch (error) {
                    console.error('[Binance] Failed to parse market message:', error);
                }
            };

            ws.onerror = () => {
                if (disposed || wsRef.current !== ws) return;
                setConnectionState({ key: feedKey, value: false });
                reportAll('error');
                ws.close();
            };

            ws.onclose = () => {
                if (disposed || wsRef.current !== ws) return;
                setConnectionState({ key: feedKey, value: false });
                setOrderBookState((previous) => (
                    previous.key === feedKey && previous.value
                        ? { key: feedKey, value: { ...previous.value, isStale: true } }
                        : previous
                ));
                provenanceRegistry.getEngine(normalizedSymbol).markDisconnected();
                scheduleReconnect(connect);
            };
        };

        connect();

        const watchdog = setInterval(() => {
            if (disposed) return;
            const now = Date.now();
            setOrderBookState((previous) => {
                if (
                    previous.key !== feedKey ||
                    !previous.value ||
                    previous.value.isStale ||
                    now - previous.value.timestamp <= STALE_BOOK_AFTER_MS
                ) {
                    return previous;
                }
                return { key: feedKey, value: { ...previous.value, isStale: true } };
            });

            const ws = wsRef.current;
            if (
                ws?.readyState === WebSocket.OPEN &&
                lastMessageAt > 0 &&
                now - lastMessageAt > STALE_SOCKET_AFTER_MS
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
            provenanceRegistry.getEngine(normalizedSymbol).markDisconnected();
            sources.forEach((source) => releaseLiveConnection(source, owner));
        };
    }, [feedKey, interval, normalizedSymbol, streamSymbol]);

    return {
        trades: tradesState.key === feedKey ? tradesState.value : [],
        candle: candleState.key === feedKey ? candleState.value : null,
        orderBook: orderBookState.key === feedKey ? orderBookState.value : null,
        isConnected: connectionState.key === feedKey && connectionState.value,
        lastUpdate: lastUpdateState.key === feedKey ? lastUpdateState.value : 0,
        reconnectCount: reconnectState.key === feedKey ? reconnectState.value : 0,
    };
};
