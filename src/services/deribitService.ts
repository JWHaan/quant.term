import { useConnectionStore } from '@/stores/connectionStore';

/**
 * Deribit WebSocket Service
 * Connects to wss://www.deribit.com/ws/api/v2 for options market data
 * 
 * Features:
 * - Exponential backoff reconnection
 * - Heartbeat monitoring (20s intervals)
 * - JSON-RPC 2.0 protocol support
 * 
 * Streams:
 * - trades.option.BTC.100ms
 * - trades.option.ETH.100ms
 */

type SubscriberCallback = (data: any) => void;

interface DeribitMessage {
    jsonrpc: string;
    id?: number;
    method?: string;
    result?: any;
    params?: {
        channel?: string;
        channels?: string[];
        data?: any;
    };
}

class DeribitService {
    private ws: WebSocket | null = null;
    private subscribers: Set<SubscriberCallback> = new Set();
    private isConnected: boolean = false;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private pingInterval: NodeJS.Timeout | null = null;

    // Reconnection backoff
    private reconnectAttempts: number = 0;
    private readonly MAX_RECONNECT_ATTEMPTS = 10;
    private readonly INITIAL_RECONNECT_DELAY = 1000;
    private readonly MAX_RECONNECT_DELAY = 30000;

    constructor() {
        // Auto-request notification permission if needed
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    /**
     * Calculate exponential backoff delay
     */
    private getReconnectDelay(): number {
        return Math.min(
            this.INITIAL_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts),
            this.MAX_RECONNECT_DELAY
        );
    }

    /**
     * Connect to Deribit WebSocket
     */
    connect(): void {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return;
        }

        const connectionStore = useConnectionStore.getState();
        connectionStore.setConnectionStatus('deribit', 'connecting');
        connectionStore.incrementReconnectAttempts('deribit');

        this.ws = new WebSocket('wss://www.deribit.com/ws/api/v2');

        this.ws.onopen = () => {
            console.log('[Deribit] WebSocket Connected');
            this.isConnected = true;
            this.reconnectAttempts = 0;

            connectionStore.setConnectionStatus('deribit', 'connected');
            connectionStore.resetReconnectAttempts('deribit');

            this.subscribe();
            this.startHeartbeat();
        };

        this.ws.onmessage = (event: MessageEvent) => {
            try {
                const message: DeribitMessage = JSON.parse(event.data);

                // Handle heartbeat/test response
                if (message.result && message.result.version) {
                    return;
                }

                // Handle subscription notifications (trades)
                if (message.method === 'subscription' && message.params?.data) {
                    this.notifySubscribers(message.params.data);
                }
            } catch (err) {
                console.error('[Deribit] Message parse error:', err);
            }
        };

        this.ws.onclose = (event: CloseEvent) => {
            console.log(`[Deribit] WebSocket Closed (Code: ${event.code})`);
            this.isConnected = false;

            connectionStore.setConnectionStatus('deribit', 'disconnected');
            this.stopHeartbeat();
            this.scheduleReconnect();
        };

        this.ws.onerror = (event: Event) => {
            console.error('[Deribit] WebSocket Error:', event);
            connectionStore.setConnectionError('deribit', 'WebSocket connection error');
            connectionStore.setConnectionStatus('deribit', 'error');

            this.ws?.close();
        };
    }

    /**
     * Subscribe to options trade streams
     */
    private subscribe(): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const subscriptionMessage: DeribitMessage = {
            jsonrpc: '2.0',
            id: 1,
            method: 'public/subscribe',
            params: {
                channels: [
                    'trades.option.BTC.100ms',
                    'trades.option.ETH.100ms'
                ]
            }
        };

        this.ws.send(JSON.stringify(subscriptionMessage));
    }

    /**
     * Subscribe to options data updates
     * @param callback - Function called with trade data
     * @returns Unsubscribe function
     */
    subscribeToUpdates(callback: SubscriberCallback): () => void {
        this.subscribers.add(callback);

        if (!this.isConnected) {
            this.connect();
        }

        return () => this.subscribers.delete(callback);
    }

    /**
     * Notify all subscribers of new data
     */
    private notifySubscribers(data: any): void {
        this.subscribers.forEach(callback => {
            try {
                callback(data);
            } catch (err) {
                console.error('[Deribit] Subscriber callback error:', err);
            }
        });
    }

    /**
     * Start heartbeat to keep connection alive
     * Deribit requires periodic test messages
     */
    private startHeartbeat(): void {
        this.stopHeartbeat();

        this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                const testMessage: DeribitMessage = {
                    jsonrpc: '2.0',
                    id: 9999,
                    method: 'public/test',
                    params: {}
                };

                this.ws.send(JSON.stringify(testMessage));
            }
        }, 20000); // 20 seconds
    }

    /**
     * Stop heartbeat timer
     */
    private stopHeartbeat(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    /**
     * Schedule reconnection with exponential backoff
     */
    private scheduleReconnect(): void {
        if (this.reconnectTimer) return;
        if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
            console.error('[Deribit] Max reconnection attempts reached');
            useConnectionStore.getState().setConnectionError('deribit', 'Max reconnection attempts exceeded');
            return;
        }

        const delay = this.getReconnectDelay();
        console.log(`[Deribit] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.MAX_RECONNECT_ATTEMPTS})`);

        useConnectionStore.getState().setConnectionStatus('deribit', 'reconnecting');

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.reconnectAttempts++;
            this.connect();
        }, delay);
    }

    /**
     * Manually disconnect
     */
    disconnect(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        this.stopHeartbeat();

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.isConnected = false;
        this.reconnectAttempts = 0;
    }
}

// Export singleton instance
export const deribitService = new DeribitService();
export default deribitService;
