import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDerivativesSnapshot } from '@/hooks/useDerivativesSnapshot';
import { getBinanceFuturesContract } from '@/integrations/binance/contracts';

vi.mock('@/integrations/binance/contracts', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/integrations/binance/contracts')>();
    return {
        ...actual,
        getBinanceFuturesContract: vi.fn(() => ({
            spotSymbol: 'BTCUSDT',
            futuresSymbol: 'BTCUSDT',
            multiplier: 1,
        })),
    };
});

const FUNDING_TIME = 1_800_000_000_000;

const premiumPayload = {
    symbol: 'BTCUSDT',
    markPrice: '100.5',
    indexPrice: '100.0',
    lastFundingRate: '0.0001',
    nextFundingTime: FUNDING_TIME,
};
const interestPayload = { symbol: 'BTCUSDT', openInterest: '123.45' };
const ratiosPayload = [{ symbol: 'BTCUSDT', longAccount: '0.6', shortAccount: '0.4' }];

const jsonResponse = (payload: unknown): Response =>
    ({
        ok: true,
        status: 200,
        json: async () => payload,
    }) as unknown as Response;

describe('useDerivativesSnapshot', () => {
    let fetchMock: ReturnType<typeof vi.fn>;
    const originalFetch = global.fetch;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-08-24T00:00:00.000Z'));
        fetchMock = vi.fn(async () => jsonResponse(premiumPayload));
        // Each round hits three distinct endpoints; answer by path.
        fetchMock.mockImplementation(async (url: string | URL | Request) => {
            const path = String(url);
            if (path.includes('/fapi/v1/premiumIndex')) return jsonResponse(premiumPayload);
            if (path.includes('/fapi/v1/openInterest')) return jsonResponse(interestPayload);
            if (path.includes('/globalLongShortAccountRatio')) return jsonResponse(ratiosPayload);
            throw new Error(`Unexpected derivatives path: ${path}`);
        });
        global.fetch = fetchMock as unknown as typeof fetch;
    });

    afterEach(() => {
        global.fetch = originalFetch;
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('resolves and exposes snapshot fields with no error', async () => {
        const { result } = renderHook(() => useDerivativesSnapshot('BTCUSDT'));
        expect(getBinanceFuturesContract).toHaveBeenCalledWith('BTCUSDT');

        await act(async () => {
            await Promise.resolve();
        });

        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeNull();
        expect(result.current.snapshot).toEqual({
            markPrice: 100.5,
            indexPrice: 100,
            fundingRate: 0.0001,
            nextFundingTime: FUNDING_TIME,
            openInterest: 123.45,
            longAccount: 0.6,
            shortAccount: 0.4,
            updatedAt: Date.now(),
        });
    });

    it('surfaces the thrown message and stops loading when fetch rejects', async () => {
        fetchMock.mockRejectedValue(new Error('network down'));

        const { result } = renderHook(() => useDerivativesSnapshot('BTCUSDT'));

        await act(async () => {
            await Promise.resolve();
        });

        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toContain('network down');
        expect(result.current.snapshot).toBeNull();
    });

    it('refresh() triggers another full fetch round', async () => {
        const { result } = renderHook(() => useDerivativesSnapshot('BTCUSDT'));

        await act(async () => {
            await Promise.resolve();
        });
        expect(fetchMock).toHaveBeenCalledTimes(3);

        act(() => {
            result.current.refresh();
        });

        await act(async () => {
            await Promise.resolve();
        });
        expect(fetchMock).toHaveBeenCalledTimes(6);
        expect(result.current.snapshot?.markPrice).toBe(100.5);
    });

    it('clears the 30s auto-refresh interval on unmount', async () => {
        const { unmount } = renderHook(() => useDerivativesSnapshot('BTCUSDT'));

        await act(async () => {
            await Promise.resolve();
        });
        expect(fetchMock).toHaveBeenCalledTimes(3);

        unmount();

        await act(async () => {
            vi.advanceTimersByTime(31_000);
            await Promise.resolve();
        });

        expect(fetchMock).toHaveBeenCalledTimes(3);
    });
});
