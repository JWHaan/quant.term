import { afterEach, describe, expect, it, vi } from 'vitest';
import { BINANCE_REST_URL } from '@/constants/config';
import {
    INTERVAL_SECONDS,
    parseKlineRow,
    fetchKlinesPage,
    fetchKlinesRange,
    NoClosedCandlesError,
    buildDatasetMeta,
    detectGaps,
} from '@/integrations/binance/klines';
import { checksumCandles } from '@/backtest/fixture';
import type { BacktestCandle } from '@/backtest/types';

const ms = (openMs: number) => [String(openMs), '42000.10000000', '42100.5', '41900.25', '42050.75000000', '12.5', 0, '0', 0, '0', '0', '0'];

const BASE_MS = 1_704_067_200_000;
const MIN_MS = 60_000;

/** Build `count` well-formed raw kline rows opening at consecutive 1m bars from `startOpenMs`. */
const rowsFrom = (startOpenMs: number, count: number): unknown[][] =>
    Array.from({ length: count }, (_, index) => ms(startOpenMs + index * MIN_MS));

const urlParam = (url: string, name: string): string | null => new URL(url).searchParams.get(name);

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

    it('throws the NoClosedCandlesError sentinel when no rows parse as closed candles', async () => {
        // closeTime far in the future → unclosed → filtered out
        const unclosed = ['9223372036854760000', '1', '1', '1', '1', '1', 9223372036854760000, '0', 0, '0', '0', '0'];
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([unclosed]), { status: 200 })));

        await expect(fetchKlinesPage({ symbol: 'BTCUSDT', interval: '5m' })).rejects.toBeInstanceOf(NoClosedCandlesError);
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

describe('fetchKlinesRange', () => {
    const servePages = (pages: unknown[][]): ReturnType<typeof vi.fn> => {
        const fetchMock = vi.fn().mockImplementation(() => {
            const callIndex = fetchMock.mock.calls.length - 1;
            return Promise.resolve(new Response(JSON.stringify(pages[callIndex] ?? []), { status: 200 }));
        });
        vi.stubGlobal('fetch', fetchMock);
        return fetchMock;
    };

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('pages forward with startTime = lastClose + interval until a short page', async () => {
        const fetchMock = servePages([rowsFrom(BASE_MS, 1000), rowsFrom(BASE_MS + 1000 * MIN_MS, 400)]);

        const { candles, requests } = await fetchKlinesRange({ symbol: 'BTCUSDT', interval: '1m', startTime: BASE_MS });

        expect(requests).toBe(2);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        const secondUrl = String(fetchMock.mock.calls[1]?.[0]);
        expect(secondUrl.startsWith(BINANCE_REST_URL)).toBe(true);
        expect(urlParam(secondUrl, 'startTime')).toBe(String(BASE_MS + 1000 * MIN_MS));
        expect(candles).toHaveLength(1400);
        expect(candles[0]?.time).toBe(BASE_MS / 1000);
        expect(candles.at(-1)?.time).toBe((BASE_MS + 1399 * MIN_MS) / 1000);
    });

    it('stops after a short page without issuing another request', async () => {
        const fetchMock = servePages([rowsFrom(BASE_MS, 3)]);

        const { candles, requests } = await fetchKlinesRange({ symbol: 'BTCUSDT', interval: '1m', startTime: BASE_MS });

        expect(requests).toBe(1);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(candles).toHaveLength(3);
    });

    it('excludes unclosed tail candles from the final page', async () => {
        // Last row opens far in the future → unclosed → must be filtered out and terminate paging.
        const unclosed = ['9223372036854760000', '1', '1', '1', '1', '1', 9_223_372_036_854_776_000, '0', 0, '0', '0', '0'];
        servePages([[...rowsFrom(BASE_MS, 2), unclosed]]);

        const { candles, requests } = await fetchKlinesRange({ symbol: 'BTCUSDT', interval: '1m', startTime: BASE_MS });

        expect(requests).toBe(1);
        expect(candles.map((candle) => candle.time)).toEqual([BASE_MS / 1000, BASE_MS / 1000 + 60]);
    });

    it('caps total candles at maxCandles and shrinks the trailing page limit', async () => {
        const fetchMock = servePages([rowsFrom(BASE_MS, 1000), rowsFrom(BASE_MS + 1000 * MIN_MS, 200)]);

        const { candles, requests } = await fetchKlinesRange({
            symbol: 'BTCUSDT',
            interval: '1m',
            startTime: BASE_MS,
            maxCandles: 1200,
        });

        expect(requests).toBe(2);
        expect(candles).toHaveLength(1200);
        expect(urlParam(String(fetchMock.mock.calls[0]?.[0]), 'limit')).toBe('1000');
        expect(urlParam(String(fetchMock.mock.calls[1]?.[0]), 'limit')).toBe('200');
    });

    it('dedupes overlapping pages and returns strictly ascending candles', async () => {
        // Second page re-serves the previous last bar; third page is short and ends the walk.
        servePages([
            rowsFrom(BASE_MS, 1000),
            rowsFrom(BASE_MS + 999 * MIN_MS, 1000),
            rowsFrom(BASE_MS + 1999 * MIN_MS, 7),
        ]);

        const { candles, requests } = await fetchKlinesRange({ symbol: 'BTCUSDT', interval: '1m', startTime: BASE_MS });

        expect(requests).toBe(3);
        expect(candles).toHaveLength(2006);
        for (let index = 1; index < candles.length; index += 1) {
            expect(candles[index]?.time).toBeGreaterThan(candles[index - 1]?.time ?? Number.NEGATIVE_INFINITY);
        }
    });

    it('returns empty candles when the very first window has no closed history', async () => {
        // Symbol lists after the requested window start → zero closed candles on
        // request #1 is legitimate history exhaustion, not an error.
        servePages([[]]);

        const { candles, requests } = await fetchKlinesRange({ symbol: 'BTCUSDT', interval: '1m', startTime: BASE_MS });

        expect(candles).toEqual([]);
        expect(requests).toBe(0);
    });

    it('propagates NoClosedCandlesError when a zero-closed-candle page hits mid-range', async () => {
        // A full page followed by an empty window means data vanished inside the
        // requested range — swallowing it would silently truncate the walk, so it
        // must surface as the sentinel instead of ending collection early.
        servePages([rowsFrom(BASE_MS, 1000), []]);

        await expect(fetchKlinesRange({ symbol: 'BTCUSDT', interval: '1m', startTime: BASE_MS }))
            .rejects.toBeInstanceOf(NoClosedCandlesError);
    });

    it('derives the window from lookbackBars when no explicit start/end is given', async () => {
        const MOCK_NOW = 1_800_000_000_000;
        vi.spyOn(Date, 'now').mockReturnValue(MOCK_NOW);
        const fetchMock = servePages([rowsFrom(BASE_MS, 1)]);
        // endTime = now - interval; startTime = endTime - (lookbackBars - 1) * interval.
        const expectedStartMs = MOCK_NOW - MIN_MS - (90 - 1) * MIN_MS;

        await fetchKlinesRange({ symbol: 'BTCUSDT', interval: '1m', lookbackBars: 90 });

        expect(urlParam(String(fetchMock.mock.calls[0]?.[0]), 'startTime')).toBe(String(expectedStartMs));
    });

    it('throws once the hard page cap is hit on a cursor that never advances', async () => {
        // Server stuck re-serving the exact same full window regardless of startTime.
        const stalledPage = rowsFrom(BASE_MS, 1000);
        vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
            Promise.resolve(new Response(JSON.stringify(stalledPage), { status: 200 }))));

        await expect(fetchKlinesRange({ symbol: 'BTCUSDT', interval: '1m', startTime: BASE_MS }))
            .rejects.toThrow(/hard page cap/);
    });

    it('propagates caller aborts mid-range', async () => {
        const controller = new AbortController();
        vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation((_url: unknown, init?: { signal?: AbortSignal }) =>
                new Promise<Response>((_resolve, reject) => {
                    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
                })),
        );

        const pending = fetchKlinesRange({ symbol: 'BTCUSDT', interval: '1m', startTime: BASE_MS }, controller.signal);
        controller.abort();

        await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    });
});

describe('buildDatasetMeta', () => {
    const candles: BacktestCandle[] = [
        { time: 1_704_067_200, open: 42_000, high: 42_100, low: 41_900, close: 42_050, volume: 12.5 },
        { time: 1_704_067_500, open: 42_050, high: 42_150, low: 42_000, close: 42_100, volume: 15.25 },
    ];

    it('builds provenance with a UTC-stamped id, REST source, and FNV-1a checksum', () => {
        const fetchedAt = Date.UTC(2024, 0, 1, 0, 1, 0); // → YYYYMMDDHHMM = 202401010001

        const meta = buildDatasetMeta(candles, 'BTCUSDT', '5m', fetchedAt);

        expect(meta.id).toBe('binance-BTCUSDT-5m-202401010001-v1');
        expect(meta.name).toContain('BTCUSDT');
        expect(meta.name).toContain('5m');
        expect(meta.symbol).toBe('BTCUSDT');
        expect(meta.interval).toBe('5m');
        expect(meta.source).toBe('BINANCE_REST');
        expect(meta.checksum).toBe(checksumCandles(candles));
        expect(meta.checksum).toMatch(/^fnv1a-[0-9a-f]{8}$/);
        expect(meta.candleCount).toBe(2);
        expect(meta.startTime).toBe(1_704_067_200);
        expect(meta.endTime).toBe(1_704_067_500);
        expect(meta.intervalSeconds).toBe(INTERVAL_SECONDS['5m']);
        expect(meta.fetchedAt).toBe(fetchedAt);
    });

    it('stamps the id from UTC, not local time', () => {
        // 2024-01-01T00:30:00Z is locally 2023-12-31 in any TZ east of UTC+00:30.
        const fetchedAt = Date.UTC(2024, 0, 1, 0, 30, 0);

        const meta = buildDatasetMeta([], 'ETHUSDT', '1h', fetchedAt);

        expect(meta.id.endsWith('-202401010030-v1')).toBe(true);
    });

    it('handles an empty candle list without NaN bounds', () => {
        const meta = buildDatasetMeta([], 'ETHUSDT', '1h', 0);

        expect(meta.id).toBe('binance-ETHUSDT-1h-197001010000-v1');
        expect(meta.candleCount).toBe(0);
        expect(meta.startTime).toBe(0);
        expect(meta.endTime).toBe(0);
        expect(meta.checksum).toBe(checksumCandles([]));
        expect(meta.intervalSeconds).toBe(INTERVAL_SECONDS['1h']);
    });
});

describe('detectGaps', () => {
    const candleAt = (time: number): BacktestCandle => ({ time, open: 1, high: 1, low: 1, close: 1, volume: 1 });

    it('counts one gap with longestGapBars=4 and missingBars=3 on [t, t+60, t+300] @60s', () => {
        const t = 1_704_067_200;

        expect(detectGaps([candleAt(t), candleAt(t + 60), candleAt(t + 300)], 60))
            .toEqual({ gapCount: 1, longestGapBars: 4, missingBars: 3 });
    });

    it('returns all zeros for contiguous candles', () => {
        const t = 1_704_067_200;

        expect(detectGaps([candleAt(t), candleAt(t + 60), candleAt(t + 120)], 60))
            .toEqual({ gapCount: 0, longestGapBars: 0, missingBars: 0 });
    });

    it('tolerates sub-tolerance jitter without flagging a gap', () => {
        const t = 1_704_067_200;

        expect(detectGaps([candleAt(t), candleAt(t + 63)], 60)).toEqual({ gapCount: 0, longestGapBars: 0, missingBars: 0 });
    });

    it('accumulates multiple gaps in missingBars and tracks the longest in bars', () => {
        const t = 1_704_067_200;

        // deltas: 180s (3 bars) and 480s (8 bars) → missing 2 + 7 = 9
        expect(detectGaps([candleAt(t), candleAt(t + 180), candleAt(t + 660)], 60))
            .toEqual({ gapCount: 2, longestGapBars: 8, missingBars: 9 });
    });

    it('returns zeros for empty input', () => {
        expect(detectGaps([], 300)).toEqual({ gapCount: 0, longestGapBars: 0, missingBars: 0 });
    });

    it('defaults the tolerance to 5 seconds', () => {
        const t = 1_704_067_200;

        expect(detectGaps([candleAt(t), candleAt(t + 65)], 60).gapCount).toBe(0);
        expect(detectGaps([candleAt(t), candleAt(t + 66)], 60).gapCount).toBe(1);
    });
});
