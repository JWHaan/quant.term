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

interface BinanceLiquidationMessage {
    e: 'forceOrder';
    o: {
        s: string;
        S: 'BUY' | 'SELL';
        p: string;
        ap: string;
        q: string;
        l: string;
        z: string;
        T: number;
    };
}

export interface LiquidationSubscription {
    close: () => void;
}

export const subscribeLiquidations = (onLiquidation: (liquidation: Liquidation) => void): LiquidationSubscription => {
    let socket: WebSocket | null = null;
    let retryTimer: number | null = null;
    let retryCount = 0;
    let active = true;
    const connection = useConnectionStore.getState();

    const connect = () => {
        if (!active) return;
        connection.setConnectionStatus('futures', retryCount ? 'reconnecting' : 'connecting');
        socket = new WebSocket('wss://fstream.binance.com/ws/!forceOrder@arr');

        socket.onopen = () => {
            retryCount = 0;
            useConnectionStore.getState().setConnectionStatus('futures', 'connected');
        };

        socket.onmessage = (event: MessageEvent<string>) => {
            try {
                const message = JSON.parse(event.data) as BinanceLiquidationMessage;
                if (message.e !== 'forceOrder' || !message.o) return;
                const order = message.o;
                const price = Number(order.ap) || Number(order.p);
                const quantity = Number(order.z) || Number(order.l) || Number(order.q);
                if (!Number.isFinite(price) || !Number.isFinite(quantity)) return;
                onLiquidation({
                    symbol: order.s,
                    side: order.S,
                    price,
                    quantity,
                    value: price * quantity,
                    time: order.T,
                    isBuy: order.S === 'BUY',
                });
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
