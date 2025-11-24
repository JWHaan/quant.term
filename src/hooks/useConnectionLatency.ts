import { useState, useEffect, useRef } from 'react';

export type ConnectionQuality = 'Excellent' | 'Good' | 'Fair' | 'Poor';

interface LatencyStats {
    latency: number;
    quality: ConnectionQuality;
    updatesPerSecond: number;
}

export const useConnectionLatency = (wsUrl: string = 'wss://stream.binance.com:9443/ws') => {
    const [stats, setStats] = useState<LatencyStats>({
        latency: 0,
        quality: 'Excellent',
        updatesPerSecond: 0
    });

    const wsRef = useRef<WebSocket | null>(null);
    const updateCountRef = useRef<number>(0);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout>(null);
    const retryCountRef = useRef<number>(0);

    // Token Bucket for Rate Limiting
    // Max 5 connections per minute
    const tokensRef = useRef<number>(5);
    const lastRefillRef = useRef<number>(Date.now());

    const refillTokens = () => {
        const now = Date.now();
        const timePassed = now - lastRefillRef.current;
        const refillAmount = Math.floor(timePassed / 12000); // 1 token every 12 seconds (5 per min)

        if (refillAmount > 0) {
            tokensRef.current = Math.min(5, tokensRef.current + refillAmount);
            lastRefillRef.current = now;
        }
    };

    const connect = () => {
        refillTokens();

        if (tokensRef.current <= 0) {
            console.warn('[WebSocket] Rate limit exceeded. Waiting for tokens...');
            // Retry later
            const delay = 12000; // Wait for at least one token
            reconnectTimeoutRef.current = setTimeout(connect, delay);
            return;
        }

        tokensRef.current--;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('[WebSocket] Connected');
            retryCountRef.current = 0; // Reset backoff on successful connection
        };

        ws.onmessage = () => {
            updateCountRef.current++;
        };

        ws.onclose = () => {
            console.log('[WebSocket] Disconnected');
            // Exponential Backoff: 1s, 2s, 4s, 8s, 16s... max 30s
            const backoff = Math.min(30000, Math.pow(2, retryCountRef.current) * 1000);
            retryCountRef.current++;

            console.log(`[WebSocket] Reconnecting in ${backoff}ms...`);
            reconnectTimeoutRef.current = setTimeout(connect, backoff);
        };

        ws.onerror = (err) => {
            console.error('[WebSocket] Error:', err);
            ws.close(); // Trigger onclose
        };
    };

    useEffect(() => {
        connect();

        // Ping Interval (Latency Check)
        const pingInterval = setInterval(() => {
            const start = performance.now();
            fetch('https://api.binance.com/api/v3/ping')
                .then(() => {
                    const end = performance.now();
                    const rtt = Math.round(end - start);

                    let quality: ConnectionQuality = 'Excellent';
                    if (rtt > 200) quality = 'Poor';
                    else if (rtt > 100) quality = 'Fair';
                    else if (rtt > 50) quality = 'Good';

                    setStats(prev => ({
                        ...prev,
                        latency: rtt,
                        quality
                    }));
                })
                .catch(() => {
                    setStats(prev => ({ ...prev, quality: 'Poor', latency: 999 }));
                });
        }, 2000);

        // UPS Interval
        const upsInterval = setInterval(() => {
            setStats(prev => ({
                ...prev,
                updatesPerSecond: updateCountRef.current
            }));
            updateCountRef.current = 0;
        }, 1000);

        return () => {
            if (wsRef.current) {
                wsRef.current.onclose = null; // Prevent reconnect on unmount
                wsRef.current.close();
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            clearInterval(pingInterval);
            clearInterval(upsInterval);
        };
    }, [wsUrl]);

    return stats;
};
