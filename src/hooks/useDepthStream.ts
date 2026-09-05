import { useEffect, useState } from 'react';
import { BINANCE_WS_URL } from '@/constants/config';
import {
    recordLiveMarketEvent,
    releaseLiveConnection,
    reportLiveConnection,
} from '@/services/marketTelemetry';

export interface DepthBookLevel {
    price: number;
    quantity: number;
}

export interface DepthBook {
    symbol: string;
    /** Best bid first (descending price). */
    bids: DepthBookLevel[];
    /** Best ask first (ascending price). */
    asks: DepthBookLevel[];
    lastUpdateId: number;
    eventTime: number | null;
    receivedAt: number;
}

interface UseDepthStreamResult {
    book: DepthBook | null;
    isConnected: boolean;
}

type BookListener = (book: DepthBook) => void;

interface DepthFeed {
    symbol: string;
    listeners: Set<BookListener>;
    statusListeners: Set<(connected: boolean) => void>;
    socket: WebSocket | null;
    reconnectTimer: ReturnType<typeof setTimeout> | null;
    watchdog: ReturnType<typeof setInterval> | null;
    reconnectAttempts: number;
    lastMessageAt: number;
    lastBook: DepthBook | null;
}

const feeds = new Map<string, DepthFeed>();
const MAX_RECONNECT_DELAY_MS = 30_000;
const STALE_AFTER_MS = 10_000;

const asRecord = (value: unknown): Record<string, unknown> | null => (
    value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null
);

const asFiniteNumber = (value: unknown): number | null => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const parseLevels = (value: unknown, side: 'bid' | 'ask'): DepthBookLevel[] => {
    if (!Array.isArray(value)) return [];

    const levels: DepthBookLevel[] = [];
    value.forEach((row) => {
        if (!Array.isArray(row) || row.length < 2) return;
        const price = asFiniteNumber(row[0]);
        const quantity = asFiniteNumber(row[1]);
        if (price === null || quantity === null || price <= 0 || quantity <= 0) return;
        levels.push({ price, quantity });
    });

    return levels.sort((a, b) => (side === 'bid' ? b.price - a.price : a.price - b.price));
};

/**
 * Parse a partial-depth snapshot. Accepts both the raw `/ws/` payload and a
 * combined-stream envelope, and rejects anything without a usable two-sided book.
 */
const parseDepthPayload = (symbol: string, raw: unknown): DepthBook | null => {
    const envelope = asRecord(raw);
    if (!envelope) return null;
    const data = asRecord(envelope['data']) ?? envelope;

    const lastUpdateId = asFiniteNumber(data['lastUpdateId']);
    const bids = parseLevels(data['bids'], 'bid');
    const asks = parseLevels(data['asks'], 'ask');
    if (lastUpdateId === null || bids.length === 0 || asks.length === 0) return null;

    return {
        symbol,
        bids,
        asks,
        lastUpdateId,
        eventTime: asFiniteNumber(data['E']) ?? asFiniteNumber(data['T']),
        receivedAt: Date.now(),
    };
};

const notifyStatus = (feed: DepthFeed, connected: boolean) => {
    feed.statusListeners.forEach((listener) => listener(connected));
};

const connect = (feed: DepthFeed) => {
    if (feeds.get(feed.symbol) !== feed || feed.listeners.size === 0 || feed.socket) return;

    reportLiveConnection(
        'depth',
        feed,
        feed.reconnectAttempts > 0 ? 'reconnecting' : 'connecting',
    );
    const socket = new WebSocket(`${BINANCE_WS_URL}/ws/${feed.symbol.toLowerCase()}@depth20@100ms`);
    feed.socket = socket;

    socket.onopen = () => {
        if (feed.socket !== socket) return;
        feed.reconnectAttempts = 0;
        feed.lastMessageAt = Date.now();
        notifyStatus(feed, true);
        reportLiveConnection('depth', feed, 'connected');
    };

    socket.onmessage = (event: MessageEvent<string>) => {
        if (feed.socket !== socket || typeof event.data !== 'string') return;
        try {
            const book = parseDepthPayload(feed.symbol, JSON.parse(event.data));
            if (!book) return;

            feed.lastMessageAt = Date.now();
            feed.lastBook = book;
            feed.listeners.forEach((listener) => listener(book));
            recordLiveMarketEvent('binance', book.eventTime ?? undefined, feed.symbol);
        } catch (error) {
            console.error('[Binance depth] Failed to parse snapshot:', error);
        }
    };

    socket.onerror = () => {
        if (feed.socket !== socket) return;
        reportLiveConnection('depth', feed, 'error');
        socket.close();
    };

    socket.onclose = () => {
        if (feed.socket !== socket) return;
        feed.socket = null;
        notifyStatus(feed, false);
        if (feed.listeners.size === 0 || feeds.get(feed.symbol) !== feed) return;

        const delay = Math.min(MAX_RECONNECT_DELAY_MS, 1_000 * (2 ** feed.reconnectAttempts));
        feed.reconnectAttempts += 1;
        reportLiveConnection('depth', feed, 'reconnecting');
        feed.reconnectTimer = setTimeout(() => {
            feed.reconnectTimer = null;
            connect(feed);
        }, delay);
    };
};

const getOrCreateFeed = (symbol: string): DepthFeed => {
    const existing = feeds.get(symbol);
    if (existing) return existing;

    const feed: DepthFeed = {
        symbol,
        listeners: new Set(),
        statusListeners: new Set(),
        socket: null,
        reconnectTimer: null,
        reconnectAttempts: 0,
        lastMessageAt: 0,
        lastBook: null,
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
    onBook: BookListener,
    onStatus: (connected: boolean) => void,
): (() => void) => {
    const feed = getOrCreateFeed(symbol);
    feed.listeners.add(onBook);
    feed.statusListeners.add(onStatus);
    onStatus(feed.socket?.readyState === WebSocket.OPEN);
    if (feed.lastBook) onBook(feed.lastBook);
    connect(feed);

    return () => {
        feed.listeners.delete(onBook);
        feed.statusListeners.delete(onStatus);
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
        releaseLiveConnection('depth', feed);
    };
};

/**
 * Shared reconnecting partial-depth feed. Every consumer of a symbol joins one
 * socket, so the chart heatmap, DOM ladder, and OFI panel never duplicate the
 * depth20 subscription.
 */
export const useDepthStream = (symbol: string): UseDepthStreamResult => {
    const normalizedSymbol = symbol.toUpperCase();
    const [book, setBook] = useState<DepthBook | null>(null);
    const [connection, setConnection] = useState({ symbol: '', connected: false });

    useEffect(() => subscribe(
        normalizedSymbol,
        setBook,
        (connected) => setConnection({ symbol: normalizedSymbol, connected }),
    ), [normalizedSymbol]);

    return {
        book: book?.symbol === normalizedSymbol ? book : null,
        isConnected: connection.symbol === normalizedSymbol && connection.connected,
    };
};
