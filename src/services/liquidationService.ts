import { BINANCE_FUTURES_WS_URL } from '@/constants/config';
import { useConnectionStore } from '@/stores/connectionStore';

export interface Liquidation {
    symbol: string;
    side: 'BUY' | 'SELL';
    price: number;
    quantity: number;
    value: number;
    time: number;
    isBuy: boolean;
}

export interface LiquidationSubscription {
    close: () => void;
}

type JsonRecord = Record<string, unknown>;

const asRecord = (value: unknown): JsonRecord | null =>
    value && typeof value === 'object' && !Array.isArray(value)
        ? value as JsonRecord
        : null;

const firstPositiveNumber = (...values: unknown[]): number | null => {
    for (const value of values) {
        if (value === null || value === undefined || value === '') continue;
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return null;
};

export const parseBinanceLiquidation = (value: unknown): Liquidation | null => {
    const message = asRecord(value);
    const order = asRecord(message?.['o']);
    if (message?.['e'] !== 'forceOrder' || !order) return null;

    const symbol = order['s'];
    const side = order['S'];
    const price = firstPositiveNumber(order['ap'], order['p']);
    const quantity = firstPositiveNumber(order['z'], order['l'], order['q']);
    const time = Number(order['T']);
    if (
        typeof symbol !== 'string' ||
        (side !== 'BUY' && side !== 'SELL') ||
        price === null ||
        quantity === null ||
        !Number.isFinite(time) ||
        time <= 0
    ) {
        return null;
    }

    return {
        symbol: symbol.toUpperCase(),
        side,
        price,
        quantity,
        value: price * quantity,
        time,
        isBuy: side === 'BUY',
    };
};

export const subscribeLiquidations = (onLiquidation: (liquidation: Liquidation) => void): LiquidationSubscription => {
    let socket: WebSocket | null = null;
    let retryTimer: number | null = null;
    let retryCount = 0;
    let active = true;
    const connection = useConnectionStore.getState();

    const connect = () => {
        if (!active) return;
        connection.setConnectionStatus('futures', retryCount ? 'reconnecting' : 'connecting');
        socket = new WebSocket(`${BINANCE_FUTURES_WS_URL}/!forceOrder@arr`);

        socket.onopen = () => {
            retryCount = 0;
            useConnectionStore.getState().setConnectionStatus('futures', 'connected');
        };

        socket.onmessage = (event: MessageEvent<string>) => {
            try {
                const liquidation = parseBinanceLiquidation(JSON.parse(event.data) as unknown);
                if (liquidation) onLiquidation(liquidation);
            } catch (error) {
                console.warn('[Liquidations] Ignored malformed exchange message.', error);
            }
        };

        socket.onerror = () => socket?.close();
        socket.onclose = () => {
            socket = null;
            if (!active) return;
            useConnectionStore.getState().setConnectionStatus('futures', 'reconnecting');
            const delay = Math.min(30_000, 1_000 * (2 ** retryCount)) + Math.floor(Math.random() * 500);
            retryCount += 1;
            retryTimer = window.setTimeout(connect, delay);
        };
    };

    connect();
    return {
        close: () => {
            active = false;
            if (retryTimer !== null) window.clearTimeout(retryTimer);
            if (socket) {
                socket.onclose = null;
                socket.close();
                socket = null;
            }
            useConnectionStore.getState().setConnectionStatus('futures', 'disconnected');
        },
    };
};
