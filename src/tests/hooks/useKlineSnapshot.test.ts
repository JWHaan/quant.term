import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useKlineSnapshot } from '@/hooks/useKlineSnapshot';

const row = (openMs: number, close: string): unknown[] => (
    [String(openMs), '42000.10', '42100.50', '41900.25', close, '12.5', openMs + 59_999, '0', 0, '0', '0', '0']
);

const BASE_MS = 1_704_067_200_000;

const jsonResponse = (payload: unknown): Response =>
    ({ ok: true, status: 200, json: async () => payload }) as unknown as Response;

describe('useKlineSnapshot', () => {
    let fetchMock: ReturnType<typeof vi.fn>;
    const originalFetch = global.fetch;

    beforeEach(() => {
        vi.useFakeTimers();
        fetchMock = vi.fn(async () => jsonResponse([row(BASE_MS, '42050.75')]));
        global.fetch = fetchMock as unknown as typeof fetch;
    });

    afterEach(() => {
        global.fetch = originalFetch;
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    const settle = async () => {
        await act(async () => {
            await Promise.resolve();
        });
    };

    it('fetches recent candles on mount and exposes parsed values', async () => {
        const { result } = renderHook(() => useKlineSnapshot('BTCUSDT', '15m', 200, { pollMs: 30_000 }));

        await settle();

        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeNull();
        expect(result.current.lastUpdated).not.toBeNull();
        expect(result.current.candles).toEqual([
            { time: BASE_MS / 1000, open: 42_000.1, high: 42_100.5, low: 41_900.25, close: 42_050.75, volume: 12.5 },
        ]);

        const url = String(fetchMock.mock.calls[0]?.[0]);
        expect(url).toContain('/api/v3/klines');
        expect(url).toContain('symbol=BTCUSDT');
        expect(url).toContain('interval=15m');
        expect(url).toContain('limit=200');
    });

    it('polls at the configured interval and stops after unmount', async () => {
        const { unmount } = renderHook(() => useKlineSnapshot('BTCUSDT', '15m', 200, { pollMs: 30_000 }));

        await settle();
        expect(fetchMock).toHaveBeenCalledTimes(1);

        await act(async () => {
            vi.advanceTimersByTime(30_000);
            await Promise.resolve();
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);

        unmount();

        await act(async () => {
            vi.advanceTimersByTime(60_000);
            await Promise.resolve();
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('keeps the previous candles and surfaces the error when a poll fails, then recovers', async () => {
        const { result } = renderHook(() => useKlineSnapshot('BTCUSDT', '1m', 200, { pollMs: 15_000 }));

        await settle();
        expect(result.current.candles).toHaveLength(1);

        fetchMock.mockRejectedValueOnce(new Error('boom'));
        await act(async () => {
            vi.advanceTimersByTime(15_000);
            await Promise.resolve();
        });
        expect(result.current.error).toContain('boom');
        expect(result.current.candles).toHaveLength(1);

        await act(async () => {
            vi.advanceTimersByTime(15_000);
            await Promise.resolve();
        });
        expect(result.current.error).toBeNull();
        expect(result.current.candles).toHaveLength(1);
    });

    it('reports a labelled timeout error when the request exceeds the deadline', async () => {
        fetchMock.mockImplementation((_url: unknown, init?: { signal?: AbortSignal }) =>
            new Promise<Response>((_resolve, reject) => {
                init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
            }));

        const { result } = renderHook(() => useKlineSnapshot('BTCUSDT', '1m', 200, { label: 'Signal' }));

        await act(async () => {
            vi.advanceTimersByTime(8_000);
            await Promise.resolve();
        });

        expect(result.current.error).toBe('Signal request timed out');
        expect(result.current.isLoading).toBe(false);
    });

    it('does not raise isLoading during background refreshes once data exists', async () => {
        const { result } = renderHook(() => useKlineSnapshot('BTCUSDT', '15m', 200, { pollMs: 30_000 }));

        await settle();
        expect(result.current.isLoading).toBe(false);

        // Next poll hangs: the panel must keep rendering retained data instead
        // of flipping back to a loading placeholder.
        fetchMock.mockImplementation(() => new Promise<Response>(() => {}));
        await act(async () => {
            vi.advanceTimersByTime(30_000);
            await Promise.resolve();
        });

        expect(result.current.isLoading).toBe(false);
        expect(result.current.candles).toHaveLength(1);
    });

    it('aborts the in-flight request when the symbol changes', async () => {
        const signals: AbortSignal[] = [];
        fetchMock.mockImplementation((_url: unknown, init?: { signal?: AbortSignal }) => {
            if (init?.signal) signals.push(init.signal);
            return new Promise<Response>(() => {});
        });

        const { result, rerender } = renderHook(
            ({ value }: { value: string }) => useKlineSnapshot(value, '1m', 200, { pollMs: 0 }),
            { initialProps: { value: 'BTCUSDT' } },
        );
        await settle();
        rerender({ value: 'ETHUSDT' });
        await settle();

        expect(signals.length).toBeGreaterThanOrEqual(2);
        expect(signals[0]?.aborted).toBe(true);
        expect(signals[1]?.aborted).toBe(false);
        expect(result.current.candles).toEqual([]);
    });
});
