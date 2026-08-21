import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProvenanceEngine } from '@/services/provenanceEngine';
import type { OHLCV } from '@/types/common';

const candle: OHLCV = {
    time: 1_700_000_000,
    open: 50_000,
    high: 50_100,
    low: 49_900,
    close: 50_050,
    volume: 12.5,
};

describe('ProvenanceEngine', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-18T00:00:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('attaches sequence, latency, and feed-health metadata', () => {
        const engine = new ProvenanceEngine('BTCUSDT');
        const exchangeTimestamp = Date.now() - 40;

        const enriched = engine.augment(candle, exchangeTimestamp);

        expect(enriched.provenance).toMatchObject({
            exchangeTimestamp,
            receivedTimestamp: Date.now(),
            sequenceNumber: 1,
            latencyMs: 40,
            isSuspectedGap: false,
            feedStatus: 'LIVE',
        });
        expect(engine.getAverageLatency()).toBe(40);
        expect(engine.getLatencyRange()).toEqual({ min: 40, max: 40 });
        expect(engine.isHealthy()).toBe(true);
    });

    it('marks a feed stale and resets its operational state', () => {
        const engine = new ProvenanceEngine('ETHUSDT', { staleThresholdMs: 1_000 });
        engine.augment(candle, Date.now() - 25);

        vi.advanceTimersByTime(1_001);
        expect(engine.getFeedStatus()).toBe('STALE');
        expect(engine.getQualityScore()).toBe(25);

        engine.reset();
        expect(engine.getFeedStatus()).toBe('DISCONNECTED');
        expect(engine.getLatencyDistribution().samples).toEqual([]);
    });
});
