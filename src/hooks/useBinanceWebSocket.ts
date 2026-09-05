import { useEffect, useRef, useState } from 'react';
import { BINANCE_WS_URL } from '@/constants/config';
import { recordLiveMarketEvent, releaseLiveConnection, reportLiveConnection } from '@/services/marketTelemetry';
import { provenanceRegistry } from '@/services/provenanceEngine';

export interface Candle {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

interface UseBinanceWebSocketReturn {
    candle: Candle | null;
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
const STALE_SOCKET_AFTER_MS = 15_000;

const asRecord = (value: unknown): JsonRecord | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as JsonRecord;
};

const asFiniteNumber = (value: unknown): number | null => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
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

/**
 * Live kline feed for one symbol and interval. Depth order book data comes
 * from the shared {@link useDepthStream} feed, so this hook owns exactly one
 * socket purpose.
 */
export const useBinanceWebSocket = (
    symbol: string = 'btcusdt',
    interval: string = '1m',
): UseBinanceWebSocketReturn => {
    const normalizedSymbol = symbol.toUpperCase();
    const streamSymbol = normalizedSymbol.toLowerCase();
    const feedKey = `${normalizedSymbol}:${interval}`;

    const [candleState, setCandleState] = useState<KeyedValue<Candle | null>>({ key: '', value: null });
    const [connectionState, setConnectionState] = useState<KeyedValue<boolean>>({ key: '', value: false });
    const [lastUpdateState, setLastUpdateState] = useState<KeyedValue<number>>({ key: '', value: 0 });
    const [reconnectState, setReconnectState] = useState<KeyedValue<number>>({ key: '', value: 0 });

    const wsRef = useRef<WebSocket | null>(null);
    const ownerRef = useRef<object>({});

    useEffect(() => {
        let disposed = false;
        let reconnectAttempts = 0;
        let hasOpened = false;
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
        let lastMessageAt = 0;
        const owner = ownerRef.current;

        const report = (status: 'connecting' | 'connected' | 'error' | 'reconnecting') => {
            reportLiveConnection('binance', owner, status);
        };

        const scheduleReconnect = (connect: () => void) => {
            if (disposed || reconnectTimer) return;
            const delay = Math.min(MAX_RECONNECT_DELAY_MS, 1_000 * (2 ** reconnectAttempts));
            reconnectAttempts += 1;
            report('reconnecting');
            reconnectTimer = setTimeout(() => {
                reconnectTimer = null;
                connect();
            }, delay);
        };

        const connect = () => {
            if (disposed) return;

            report(reconnectAttempts > 0 ? 'reconnecting' : 'connecting');
            const ws = new WebSocket(`${BINANCE_WS_URL}/ws/${streamSymbol}@kline_${interval}`);
            wsRef.current = ws;

            ws.onopen = () => {
                if (disposed || wsRef.current !== ws) return;
                lastMessageAt = Date.now();
                reconnectAttempts = 0;
                setConnectionState({ key: feedKey, value: true });
                report('connected');

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

                    const isKline = data['e'] === 'kline' || stream?.includes('@kline_');
                    if (!isKline) return;

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
                } catch (error) {
                    console.error('[Binance] Failed to parse market message:', error);
                }
            };

            ws.onerror = () => {
                if (disposed || wsRef.current !== ws) return;
                setConnectionState({ key: feedKey, value: false });
                report('error');
                ws.close();
            };

            ws.onclose = () => {
                if (disposed || wsRef.current !== ws) return;
                setConnectionState({ key: feedKey, value: false });
                provenanceRegistry.getEngine(normalizedSymbol).markDisconnected();
                scheduleReconnect(connect);
            };
        };

        connect();

        const watchdog = setInterval(() => {
            if (disposed) return;
            const ws = wsRef.current;
            if (
                ws?.readyState === WebSocket.OPEN &&
                lastMessageAt > 0 &&
                Date.now() - lastMessageAt > STALE_SOCKET_AFTER_MS
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
            releaseLiveConnection('binance', owner);
        };
    }, [feedKey, interval, normalizedSymbol, streamSymbol]);

    return {
        candle: candleState.key === feedKey ? candleState.value : null,
        isConnected: connectionState.key === feedKey && connectionState.value,
        lastUpdate: lastUpdateState.key === feedKey ? lastUpdateState.value : 0,
        reconnectCount: reconnectState.key === feedKey ? reconnectState.value : 0,
    };
};
