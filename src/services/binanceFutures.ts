/**
 * @deprecated This service is not wired into the UI.
 * Kept as reference for futures WebSocket implementation.
 * The active data feed uses useBinanceWebSocket (spot) and useOrderBook (depth).
 * To use this: import { futuresWS } from '@/services/binanceFutures'
 */

import { useConnectionStore } from '@/stores/connectionStore';
import { provenanceRegistry } from '@/services/provenanceEngine';

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

    private reconnectAttempts: number = 0;
    private readonly MAX_RECONNECT_ATTEMPTS = 10;
    private readonly INITIAL_RECONNECT_DELAY = 1000;
    private readonly MAX_RECONNECT_DELAY = 30000;

    private rateLimit: RateLimitInfo = {
        messagesPerSecond: 5,
        connectionsPerFiveMinutes: 300,
        lastReset: Date.now(),
        messageCount: 0,
        connectionCount: 0
    };

    constructor() {
        setInterval(() => this.resetRateLimitCounters(), 1000);
    }

    private resetRateLimitCounters(): void {
        const now = Date.now();
        if (now - this.rateLimit.lastReset >= 1000) {
            this.rateLimit.messageCount = 0;
            this.rateLimit.lastReset = now;
        }
        if (now - this.rateLimit.lastReset >= 300000) {
            this.rateLimit.connectionCount = 0;
        }
    }

    private canConnect(): boolean {
        this.resetRateLimitCounters();
        if (this.rateLimit.connectionCount >= this.rateLimit.connectionsPerFiveMinutes) {
            console.warn('[Binance] Rate limit: Max connections per 5 minutes exceeded');
            return false;
        }
        return true;
    }

    private canSendMessage(): boolean {
        this.resetRateLimitCounters();
        if (this.rateLimit.messageCount >= this.rateLimit.messagesPerSecond) {
            console.warn('[Binance] Rate limit: Max messages per second exceeded');
            return false;
        }
        return true;
    }

    private trackMessageSent(): void {
        this.rateLimit.messageCount++;
    }

    private getReconnectDelay(): number {
        return Math.min(
            this.INITIAL_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts),
            this.MAX_RECONNECT_DELAY
        );
    }

    connect(): void {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return;
        }
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
            this.reconnectAttempts = 0;
            connectionStore.setConnectionStatus('binance', 'connected');
            connectionStore.resetReconnectAttempts('binance');
            this.resubscribe();
            this.startHeartbeat();
        };

        this.ws.onmessage = (event: MessageEvent) => {
            try {
                const receivedTimestamp = Date.now();
                const data = JSON.parse(event.data);
                if (data.id === 999) return;

                if (data.e) {
                    const eventType: string = data.e;
                    const symbol: string | undefined = data.s;
                    const exchangeTimestamp = data.E || data.T || receivedTimestamp;

                    if (symbol) {
                        const engine = provenanceRegistry.getEngine(symbol);
                        const latencyMs = receivedTimestamp - exchangeTimestamp;
                        data._provenance = {
                            exchangeTimestamp,
                            receivedTimestamp,
                            latencyMs,
                            feedStatus: engine.getFeedStatus()
                        };
                        useConnectionStore.getState().setLatency('binance', latencyMs);
                    }

                    const topics = [
                        eventType,
                        symbol ? `${symbol}@${eventType}` : null,
                        symbol ? `${symbol.toLowerCase()}@${eventType}` : null
                    ].filter((t): t is string => t !== null);

                    topics.forEach(topic => {
                        const callbacks = this.subscribers.get(topic);
                        if (callbacks) {
                            callbacks.forEach(cb => {
                                try { cb(data); } catch (err) {
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
            this.ws?.close();
        };
    }

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

    unsubscribe(streams: string | string[], callback: WebSocketCallback): void {
        const streamArray = Array.isArray(streams) ? streams : [streams];
        streamArray.forEach(stream => {
            const callbacks = this.subscribers.get(stream);
            if (callbacks) {
                callbacks.delete(callback);
                if (callbacks.size === 0) {
                    this.subscribers.delete(stream);
                    this.activeSubscriptions.delete(stream);
                    this.sendUnsubscription([stream]);
                }
            }
        });
    }

    private sendSubscription(streams: string[]): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        if (!this.canSendMessage()) {
            console.warn('[Binance] Subscription delayed due to rate limit');
            setTimeout(() => this.sendSubscription(streams), 1000);
            return;
        }
        const payload = { method: 'SUBSCRIBE', params: streams, id: Date.now() };
        this.ws.send(JSON.stringify(payload));
        this.trackMessageSent();
    }

    private sendUnsubscription(streams: string[]): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        if (!this.canSendMessage()) return;
        const payload = { method: 'UNSUBSCRIBE', params: streams, id: Date.now() };
        this.ws.send(JSON.stringify(payload));
        this.trackMessageSent();
    }

    private resubscribe(): void {
        if (this.activeSubscriptions.size > 0) {
            this.sendSubscription(Array.from(this.activeSubscriptions));
        }
    }

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
                if (latency > 60000) {
                    console.warn('[Binance] Stale connection detected, reconnecting...');
                    this.ws.close();
                }
            }
        }, 30000);
    }

    private stopHeartbeat(): void {
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
    }

    getRateLimitStatus(): RateLimitInfo {
        return { ...this.rateLimit };
    }

    disconnect(): void {
        if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
        this.stopHeartbeat();
        if (this.ws) { this.ws.close(); this.ws = null; }
        this.isConnected = false;
        this.reconnectAttempts = 0;
    }
}

export const futuresWS = new BinanceFuturesService();
export default futuresWS;
