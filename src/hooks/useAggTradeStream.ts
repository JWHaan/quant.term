import { useEffect, useRef, useState } from 'react';
import { BINANCE_WS_URL } from '@/constants/config';

export interface AggTradeEvent {
    id: number;
    price: number;
    quantity: number;
    timestamp: number;
    isBuyerMaker: boolean;
}

type Listener = (trade: AggTradeEvent) => void;

interface SharedFeed {
    symbol: string;
    listeners: Set<Listener>;
    statusListeners: Set<(connected: boolean) => void>;
    socket: WebSocket | null;
    reconnectTimer: ReturnType<typeof setTimeout> | null;
    watchdog: ReturnType<typeof setInterval> | null;
    reconnectAttempts: number;
    lastMessageAt: number;
}

const feeds = new Map<string, SharedFeed>();
const STALE_AFTER_MS = 15_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

const notifyStatus = (feed: SharedFeed, connected: boolean) => {
    feed.statusListeners.forEach((listener) => listener(connected));
};

const connect = (feed: SharedFeed) => {
    if (feeds.get(feed.symbol) !== feed || feed.listeners.size === 0 || feed.socket) return;

    const socket = new WebSocket(`${BINANCE_WS_URL}/ws/${feed.symbol.toLowerCase()}@aggTrade`);
    feed.socket = socket;

    socket.onopen = () => {
        if (feed.socket !== socket) return;
        feed.reconnectAttempts = 0;
        feed.lastMessageAt = Date.now();
        notifyStatus(feed, true);
    };

    socket.onmessage = (event: MessageEvent<string>) => {
        if (feed.socket !== socket) return;
        try {
            const data = JSON.parse(event.data) as Record<string, unknown>;
            const trade: AggTradeEvent = {
                id: Number(data['a']),
                price: Number(data['p']),
                quantity: Number(data['q']),
                timestamp: Number(data['T']),
                isBuyerMaker: data['m'] === true,
            };
            if (![trade.id, trade.price, trade.quantity, trade.timestamp].every(Number.isFinite)) return;
            feed.lastMessageAt = Date.now();
            feed.listeners.forEach((listener) => listener(trade));
        } catch (error) {
            console.error('[Binance aggTrade] Failed to parse trade:', error);
        }
    };

    socket.onerror = () => socket.close();
    socket.onclose = () => {
        if (feed.socket !== socket) return;
        feed.socket = null;
        notifyStatus(feed, false);
        if (feed.listeners.size === 0 || feeds.get(feed.symbol) !== feed) return;

        const delay = Math.min(MAX_RECONNECT_DELAY_MS, 1_000 * (2 ** feed.reconnectAttempts));
        feed.reconnectAttempts += 1;
        feed.reconnectTimer = setTimeout(() => {
            feed.reconnectTimer = null;
            connect(feed);
        }, delay);
    };
};

const getOrCreateFeed = (symbol: string): SharedFeed => {
    const existing = feeds.get(symbol);
    if (existing) return existing;

    const feed: SharedFeed = {
        symbol,
        listeners: new Set(),
        statusListeners: new Set(),
        socket: null,
        reconnectTimer: null,
        reconnectAttempts: 0,
        lastMessageAt: 0,
        watchdog: null,
    };
    feed.watchdog = setInterval(() => {
        if (
            feed.socket?.readyState === WebSocket.OPEN &&
            feed.lastMessageAt > 0 &&
            Date.now() - feed.lastMessageAt > STALE_AFTER_MS
        ) {
            feed.socket.close();
        }
    }, 1_000);
    feeds.set(symbol, feed);
    return feed;
};

const subscribe = (
    symbol: string,
    listener: Listener,
    statusListener: (connected: boolean) => void,
): (() => void) => {
    const feed = getOrCreateFeed(symbol);
    feed.listeners.add(listener);
    feed.statusListeners.add(statusListener);
    statusListener(feed.socket?.readyState === WebSocket.OPEN);
    connect(feed);

    return () => {
        feed.listeners.delete(listener);
        feed.statusListeners.delete(statusListener);
        if (feed.listeners.size > 0) return;

        if (feed.reconnectTimer) clearTimeout(feed.reconnectTimer);
        if (feed.watchdog) clearInterval(feed.watchdog);
        const socket = feed.socket;
        feed.socket = null;
        if (socket) {
            socket.onopen = null;
            socket.onmessage = null;
            socket.onerror = null;
            socket.onclose = null;
            if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close();
        }
        feeds.delete(symbol);
    };
};

/** Shares one reconnecting aggregate-trade socket between all consumers of a symbol. */
export const useAggTradeStream = (symbol: string, onTrade: Listener): boolean => {
    const normalizedSymbol = symbol.toUpperCase();
    const listenerRef = useRef(onTrade);
    const [connection, setConnection] = useState({ symbol: '', connected: false });

    useEffect(() => {
        listenerRef.current = onTrade;
    }, [onTrade]);

    useEffect(() => subscribe(
        normalizedSymbol,
        (trade) => listenerRef.current(trade),
        (connected) => setConnection({ symbol: normalizedSymbol, connected }),
    ), [normalizedSymbol]);

    return connection.symbol === normalizedSymbol && connection.connected;
};
