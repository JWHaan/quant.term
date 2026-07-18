import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useConnectionLatency } from '@/hooks/useConnectionLatency';
import { recordLiveMarketEvent } from '@/services/marketTelemetry';

describe('useConnectionLatency', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-18T00:00:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('reports selected-symbol message latency and update rate', () => {
        const { result } = renderHook(() => useConnectionLatency('btcusdt'));
        const now = Date.now();

        act(() => {
            recordLiveMarketEvent('binance', now - 80, 'BTCUSDT');
            recordLiveMarketEvent('binance', now - 20, 'BTCUSDT');
            recordLiveMarketEvent('binance', now - 60, 'BTCUSDT');
            recordLiveMarketEvent('binance', now - 5, 'ETHUSDT');
            vi.advanceTimersByTime(1_000);
        });

        expect(result.current).toEqual({
            latency: 60,
            quality: 'Good',
            updatesPerSecond: 3,
        });
    });

    it('marks telemetry poor after the selected feed becomes stale', () => {
        const { result } = renderHook(() => useConnectionLatency('BTCUSDT'));

        act(() => {
            recordLiveMarketEvent('binance', Date.now() - 40, 'BTCUSDT');
            vi.advanceTimersByTime(1_000);
        });
        expect(result.current.quality).toBe('Excellent');

        act(() => {
            vi.advanceTimersByTime(3_001);
        });

        expect(result.current).toEqual({
            latency: 0,
            quality: 'Poor',
            updatesPerSecond: 0,
        });
    });
});
