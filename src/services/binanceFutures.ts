import { useConnectionStore } from '@/stores/connectionStore';
import { provenanceRegistry } from '@/services/provenanceEngine';

/**
 * Binance Futures WebSocket Service
 * Connects to wss://fstream.binance.com for real-time derivatives data
 * 
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Rate limit tracking (5 msg/sec, 300 conn/5min)
 * - Subscription management
 * - Heartbeat/ping monitoring
 * 
 * Streams supported:
 * - @forceOrder: Real-time liquidations
 * - @markPrice: Real-time funding rates and index prices
 * - @depth: Order book updates
 * - @aggTrade: Aggregated trade data
 */

type WebSocketCallback = (data: any) => void;

interface RateLimitInfo {
    messagesPerSecond: number;
    connectionsPerFiveMinutes: number;
    lastReset: number;
    messageCount: number;
    connectionCount: number;
}

class BinanceFuturesService {
    private ws: WebSocket | null = null;
    private subscribers: Map<string, Set<WebSocketCallback>> = new Map();
    private reconnectTimer: NodeJS.Timeout | null = null;
    private pingTimer: NodeJS.Timeout | null = null;
    private isConnected: boolean = false;
    private activeSubscriptions: Set<string> = new Set();
    private lastPingTime: number = 0;

    // Rate limiting
    private reconnectAttempts: number = 0;
    private readonly MAX_RECONNECT_ATTEMPTS = 10;
    private readonly INITIAL_RECONNECT_DELAY = 1000; // 1 second
    private readonly MAX_RECONNECT_DELAY = 30000; // 30 seconds

    // Binance rate limits: 5 messages/second, 300 connections/5 minutes
    private rateLimit: RateLimitInfo = {
        messagesPerSecond: 5,
        connectionsPerFiveMinutes: 300,
        lastReset: Date.now(),
        messageCount: 0,
        connectionCount: 0
    };

    constructor() {
        // Reset rate limit counters periodically
        setInterval(() => this.resetRateLimitCounters(), 1000);
    }

    /**
     * Reset rate limit message counter every second
     */
    private resetRateLimitCounters(): void {
        const now = Date.now();

        // Reset message counter every second
        if (now - this.rateLimit.lastReset >= 1000) {
            this.rateLimit.messageCount = 0;
            this.rateLimit.lastReset = now;
        }

        // Reset connection counter every 5 minutes
        if (now - this.rateLimit.lastReset >= 300000) {
            this.rateLimit.connectionCount = 0;
        }
    }

    /**
     * Check if we're within rate limits before making a new connection
     */
    private canConnect(): boolean {
        this.resetRateLimitCounters();

        if (this.rateLimit.connectionCount >= this.rateLimit.connectionsPerFiveMinutes) {
            console.warn('[Binance] Rate limit: Max connections per 5 minutes exceeded');
            return false;
        }

        return true;
    }

    /**
     * Check if we can send a message within rate limits
     */
    private canSendMessage(): boolean {
        this.resetRateLimitCounters();

        if (this.rateLimit.messageCount >= this.rateLimit.messagesPerSecond) {
            console.warn('[Binance] Rate limit: Max messages per second exceeded');
            return false;
        }

        return true;
    }

    /**
     * Track message send for rate limiting
     */
    private trackMessageSent(): void {
        this.rateLimit.messageCount++;
    }

    /**
     * Calculate exponential backoff delay based on attempt count
     * Delay sequence: 1s → 2s → 4s → 8s → 16s → max 30s
     */
    private getReconnectDelay(): number {
        const delay = Math.min(
            this.INITIAL_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts),
            this.MAX_RECONNECT_DELAY
        );
        return delay;
    }

    /**
     * Connect to Binance Futures WebSocket
     */
    connect(): void {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return;
        }

        // Check rate limits
        if (!this.canConnect()) {
            console.error('[Binance] Cannot connect: Rate limit exceeded');
            this.scheduleReconnect();
            return;
        }

        const connectionStore = useConnectionStore.getState();
        connectionStore.setConnectionStatus('binance', 'connecting');
        connectionStore.incrementReconnectAttempts('binance');

        this.rateLimit.connectionCount++;
        this.ws = new WebSocket('wss://fstream.binance.com/ws');

        this.ws.onopen = () => {
            console.log('[Binance] WebSocket Connected');
            this.isConnected = true;
            this.reconnectAttempts = 0; // Reset on successful connection

            connectionStore.setConnectionStatus('binance', 'connected');
            connectionStore.resetReconnectAttempts('binance');

            this.resubscribe();
            this.startHeartbeat();
        };

        this.ws.onmessage = (event: MessageEvent) => {
            try {
                const receivedTimestamp = Date.now();
                const data = JSON.parse(event.data);

                // Handle ping/pong
                if (data.id === 999) return;

                // Route to subscribers based on event type
                if (data.e) {
                    const eventType: string = data.e;
                    const symbol: string | undefined = data.s;

                    // Extract exchange timestamp (Binance uses 'E' for event time in ms)
                    const exchangeTimestamp = data.E || data.T || receivedTimestamp;

                    // Augment data with provenance if symbol is present
                    if (symbol) {
                        const engine = provenanceRegistry.getEngine(symbol);
                        const latencyMs = receivedTimestamp - exchangeTimestamp;

                        // Add provenance metadata to data object
                        data._provenance = {
                            exchangeTimestamp,
                            receivedTimestamp,
                            latencyMs,
                            feedStatus: engine.getFeedStatus()
                        };

                        // Update connection store with latest latency
                        useConnectionStore.getState().setLatency('binance', latencyMs);
                    }

                    // Construct possible topic variants
                    const topics = [
                        eventType,
                        symbol ? `${symbol}@${eventType}` : null,
                        symbol ? `${symbol.toLowerCase()}@${eventType}` : null
                    ].filter((t): t is string => t !== null);

                    // Notify all subscribers for matching topics
                    topics.forEach(topic => {
                        const callbacks = this.subscribers.get(topic);
                        if (callbacks) {
                            callbacks.forEach(cb => {
                                try {
                                    cb(data);
                                } catch (err) {
                                    console.error(`[Binance] Subscriber callback error for ${topic}:`, err);
                                }
                            });
                        }
                    });
                }
            } catch (err) {
                console.error('[Binance] Message parse error:', err);
            }
        };

        this.ws.onclose = (event: CloseEvent) => {
            console.log(`[Binance] WebSocket Closed(Code: ${event.code}, Reason: ${event.reason})`);
            this.isConnected = false;

            connectionStore.setConnectionStatus('binance', 'disconnected');
            this.stopHeartbeat();
            this.scheduleReconnect();
        };

        this.ws.onerror = (event: Event) => {
            console.error('[Binance] WebSocket Error:', event);
            connectionStore.setConnectionError('binance', 'WebSocket connection error');
            connectionStore.setConnectionStatus('binance', 'error');

            // Close will trigger reconnection logic
            this.ws?.close();
        };
    }

    /**
     * Subscribe to one or more streams
     * @param streams - Stream names (e.g., 'btcusdt@forceOrder', 'ethusdt@markPrice')
     * @param callback - Function to call when data arrives
     */
    subscribe(streams: string | string[], callback: WebSocketCallback): void {
        const streamArray = Array.isArray(streams) ? streams : [streams];

        streamArray.forEach(stream => {
            if (!this.subscribers.has(stream)) {
                this.subscribers.set(stream, new Set());
            }
            this.subscribers.get(stream)!.add(callback);
            this.activeSubscriptions.add(stream);
        });

        if (this.isConnected) {
            this.sendSubscription(streamArray);
        } else {
            this.connect();
        }
    }

    /**
     * Unsubscribe from streams
     */
    unsubscribe(streams: string | string[], callback: WebSocketCallback): void {
        const streamArray = Array.isArray(streams) ? streams : [streams];

        streamArray.forEach(stream => {
            const callbacks = this.subscribers.get(stream);
            if (callbacks) {
                callbacks.delete(callback);

                // Clean up if no callbacks left
                if (callbacks.size === 0) {
                    this.subscribers.delete(stream);
                    this.activeSubscriptions.delete(stream);
                    this.sendUnsubscription([stream]);
                }
            }
        });
    }

    /**
     * Send subscription message to Binance
     */
    private sendSubscription(streams: string[]): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        if (!this.canSendMessage()) {
            console.warn('[Binance] Subscription delayed due to rate limit');
            setTimeout(() => this.sendSubscription(streams), 1000);
            return;
        }

        const payload = {
            method: 'SUBSCRIBE',
            params: streams,
            id: Date.now()
        };

        this.ws.send(JSON.stringify(payload));
        this.trackMessageSent();
    }

    /**
     * Send unsubscription message to Binance
     */
    private sendUnsubscription(streams: string[]): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        if (!this.canSendMessage()) return; // Skip if rate limited

        const payload = {
            method: 'UNSUBSCRIBE',
            params: streams,
            id: Date.now()
        };

        this.ws.send(JSON.stringify(payload));
        this.trackMessageSent();
    }

    /**
     * Resubscribe to all active subscriptions after reconnection
     */
    private resubscribe(): void {
        if (this.activeSubscriptions.size > 0) {
            this.sendSubscription(Array.from(this.activeSubscriptions));
        }
    }

    /**
     * Schedule reconnection with exponential backoff
     */
    private scheduleReconnect(): void {
        if (this.reconnectTimer) return;
        if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
            console.error('[Binance] Max reconnection attempts reached');
            useConnectionStore.getState().setConnectionError('binance', 'Max reconnection attempts exceeded');
            return;
        }

        const delay = this.getReconnectDelay();
        console.log(`[Binance] Reconnecting in ${delay} ms(attempt ${this.reconnectAttempts + 1} / ${this.MAX_RECONNECT_ATTEMPTS})`);

        useConnectionStore.getState().setConnectionStatus('binance', 'reconnecting');

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.reconnectAttempts++;
            this.connect();
        }, delay);
    }

    /**
     * Start heartbeat to keep connection alive
     * Binance WebSocket doesn't require explicit ping, but we monitor health
     */
    private startHeartbeat(): void {
        this.stopHeartbeat();

        this.pingTimer = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                const now = Date.now();
                const latency = now - this.lastPingTime;

                if (latency > 0) {
                    useConnectionStore.getState().setLatency('binance', latency);
                }

                this.lastPingTime = now;

                // Check for stale connection (no data in 60 seconds)
                if (latency > 60000) {
                    console.warn('[Binance] Stale connection detected, reconnecting...');
                    this.ws.close();
                }
            }
        }, 30000); // Check every 30 seconds
    }

    /**
     * Stop heartbeat timer
     */
    private stopHeartbeat(): void {
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
    }

    /**
     * Get current rate limit status
     */
    getRateLimitStatus(): RateLimitInfo {
        return { ...this.rateLimit };
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
export const futuresWS = new BinanceFuturesService();
export default futuresWS;
