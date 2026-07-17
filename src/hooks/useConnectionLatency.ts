import { useEffect, useMemo, useRef, useState } from 'react';
import { subscribeToLiveMarketEvents } from '@/services/liveMarketData';
import { useConnectionStore } from '@/stores/connectionStore';

export type ConnectionQuality = 'Excellent' | 'Good' | 'Fair' | 'Poor';

interface LatencyStats {
    latency: number;
    quality: ConnectionQuality;
    updatesPerSecond: number;
}

const STALE_TELEMETRY_AFTER_MS = 3_000;

const qualityForLatency = (latency: number): ConnectionQuality => {
    if (latency > 200) return 'Poor';
    if (latency > 100) return 'Fair';
    if (latency > 50) return 'Good';
    return 'Excellent';
};

const median = (samples: number[]): number => {
    if (samples.length === 0) return 0;
    const sorted = [...samples].sort((a, b) => a - b);
    return Math.round(sorted[Math.floor(sorted.length / 2)] ?? 0);
};

/**
 * Reports timing from actual exchange messages for the selected symbol.
 * The parameter is a symbol (for example BTCUSDT), not a WebSocket URL.
 */
export const useConnectionLatency = (symbol: string = 'BTCUSDT'): LatencyStats => {
    const normalizedSymbol = useMemo(() => symbol.toUpperCase(), [symbol]);
    const [stats, setStats] = useState<LatencyStats>({
        latency: 0,
        quality: 'Poor',
        updatesPerSecond: 0,
    });

    const updateCountRef = useRef(0);
    const latencySamplesRef = useRef<number[]>([]);
    const lastEventAtRef = useRef(0);
    const lastLatencyRef = useRef(0);

    useEffect(() => {
        updateCountRef.current = 0;
        latencySamplesRef.current = [];
        lastEventAtRef.current = 0;
        lastLatencyRef.current = 0;

        const unsubscribe = subscribeToLiveMarketEvents((event) => {
            if (event.source !== 'binance' || event.symbol !== normalizedSymbol) return;
            updateCountRef.current += 1;
            lastEventAtRef.current = event.receivedAt;
            if (event.latencyMs !== null) latencySamplesRef.current.push(event.latencyMs);
        });

        const sampleInterval = setInterval(() => {
            const now = Date.now();
            const updatesPerSecond = updateCountRef.current;
            const samples = latencySamplesRef.current;
            const isStale = lastEventAtRef.current === 0 || now - lastEventAtRef.current > STALE_TELEMETRY_AFTER_MS;

            if (samples.length > 0) lastLatencyRef.current = median(samples);
            const latency = isStale ? 0 : lastLatencyRef.current;
            const quality = isStale || latency === 0 ? 'Poor' : qualityForLatency(latency);

            if (!isStale && latency > 0) {
                useConnectionStore.getState().setLatency('binance', latency);
            }

            setStats({ latency, quality, updatesPerSecond });
            updateCountRef.current = 0;
            latencySamplesRef.current = [];
        }, 1_000);

        return () => {
            unsubscribe();
            clearInterval(sampleInterval);
        };
    }, [normalizedSymbol]);

    return stats;
};
