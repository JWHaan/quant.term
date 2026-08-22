import { afterEach, describe, expect, it, vi } from 'vitest';
import { INTERVAL_SECONDS, parseKlineRow, fetchKlinesPage } from '@/integrations/binance/klines';

const ms = (openMs: number) => [String(openMs), '42000.10000000', '42100.5', '41900.25', '42050.75000000', '12.5', 0, '0', 0, '0', '0', '0'];

describe('kline adapter primitives', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('maps every supported interval to bar seconds', () => {
        expect(INTERVAL_SECONDS['1m']).toBe(60);
        expect(INTERVAL_SECONDS['1h']).toBe(3_600);
        expect(INTERVAL_SECONDS['1d']).toBe(86_400);
    });

    it('parses decimal strings and converts open time to seconds', () => {
        const candle = parseKlineRow(ms(1_704_067_200_000), 60, 1_800_000_000_000);
        expect(candle).toEqual({ time: 1_704_067_200, open: 42_000.1, high: 42_100.5, low: 41_900.25, close: 42_050.75, volume: 12.5 });
    });

    it('rejects unclosed candles whose close time is in the future', () => {
        expect(parseKlineRow(ms(Date.now() - 10_000), 60, Date.now())).toBeNull();
    });

    it('rejects malformed rows', () => {
        expect(parseKlineRow(['x'], 60, Date.now())).toBeNull();
        expect(parseKlineRow(null, 60, Date.now())).toBeNull();
    });
});

describe('fetchKlinesPage', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('requests the right URL and returns parsed closed candles', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([ms(1_704_067_200_000)]), { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);

        const candles = await fetchKlinesPage({ symbol: 'BTCUSDT', interval: '5m', startTime: 1_704_067_200_000 }, undefined);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const firstCall = fetchMock.mock.calls[0];
        expect(firstCall).toBeDefined();
        const url = String(firstCall?.[0]);
        expect(url.startsWith('https://data-api.binance.vision/api/v3/klines')).toBe(true);
        expect(url).toContain('symbol=BTCUSDT');
        expect(url).toContain('interval=5m');
        expect(url).toContain('startTime=1704067200000');
        expect(url).toContain('limit=1000');
        expect(candles).toEqual([{ time: 1_704_067_200, open: 42_000.1, high: 42_100.5, low: 41_900.25, close: 42_050.75, volume: 12.5 }]);
    });

    it('throws on HTTP failure with status in message', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 418 })));

        await expect(fetchKlinesPage({ symbol: 'BTCUSDT', interval: '5m' })).rejects.toThrow('Failed to fetch klines (418)');
    });

    it('throws when no rows parse as closed candles', async () => {
        // closeTime far in the future → unclosed → filtered out
        const unclosed = ['9223372036854760000', '1', '1', '1', '1', '1', 9223372036854760000, '0', 0, '0', '0', '0'];
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([unclosed]), { status: 200 })));

        await expect(fetchKlinesPage({ symbol: 'BTCUSDT', interval: '5m' })).rejects.toThrow();
    });

    it('races the 8s timeout with the caller-provided abort signal', async () => {
        const controller = new AbortController();
        let received: AbortSignal | undefined;
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((_url: unknown, init?: { signal?: AbortSignal }) => {
                received = init?.signal;
                return new Promise<Response>(() => {}); // never settles on its own
            }),
        );

        const pending = fetchKlinesPage({ symbol: 'BTCUSDT', interval: '5m' }, controller.signal);
        pending.catch(() => {});
        await vi.waitFor(() => expect(received).toBeDefined());

        // The signal handed to fetch must be a composite, not the raw caller signal,
        // so the 8s deadline stays armed even when the caller supplies their own signal.
        expect(received).not.toBe(controller.signal);
        controller.abort();
        expect(received?.aborted).toBe(true);
    });
});
