import { BINANCE_REST_URL } from '@/constants/config';
import type { BacktestCandle, BacktestDataset } from '@/backtest/types';
import { checksumCandles } from '@/backtest/fixture';
import type { Timeframe } from '@/types/common';

/** Bar duration in seconds for every supported Binance kline interval. */
export const INTERVAL_SECONDS: Record<Timeframe, number> = {
    '1m': 60,
    '3m': 180,
    '5m': 300,
    '15m': 900,
    '30m': 1_800,
    '1h': 3_600,
    '2h': 7_200,
    '4h': 14_400,
    '6h': 21_600,
    '12h': 43_200,
    '1d': 86_400,
    '3d': 259_200,
    '1w': 604_800,
    '1M': 2_592_000,
};

export interface KlinesRequest {
    symbol: string;
    interval: Timeframe;
    startTime?: number;
    endTime?: number;
    limit?: number;
}

const KLINES_PATH = '/api/v3/klines';
const KLINES_TIMEOUT_MS = 8_000;
const DEFAULT_PAGE_LIMIT = 1_000;
const NO_CLOSED_CANDLES_MESSAGE = 'Failed to fetch klines: no closed candles in response';

/**
 * Sentinel thrown by fetchKlinesPage when a 200 response yields zero closed candles
 * (empty array or every row unclosed/malformed). Callers branch on `instanceof`
 * rather than matching message text, so rewording can never break control flow.
 */
export class NoClosedCandlesError extends Error {
    constructor(message = NO_CLOSED_CANDLES_MESSAGE) {
        super(message);
        this.name = 'NoClosedCandlesError';
    }
}

/**
 * Parse one raw Binance REST kline row into a candle.
 * Returns null for malformed rows or candles whose close time is still in the future.
 */
export const parseKlineRow = (row: unknown, intervalSeconds: number, nowMs: number): BacktestCandle | null => {
    if (!Array.isArray(row) || row.length < 7) return null;

    const openMs = Number(row[0]);
    const open = Number(row[1]);
    const high = Number(row[2]);
    const low = Number(row[3]);
    const close = Number(row[4]);
    const volume = Number(row[5]);

    if (![openMs, open, high, low, close, volume].every(Number.isFinite)) return null;

    // Spec: a candle is closed iff its close time is strictly before nowMs.
    // Binance row[6] already IS the close time (openMs + interval − 1), so no
    // interval is added here. The Math.max floor only tolerates test fixtures
    // that carry closeTime=0; on real REST rows it is a no-op.
    const closeMs = Math.max(Number(row[6]), openMs + intervalSeconds * 1_000 - 1);
    if (!Number.isFinite(closeMs) || !(closeMs < nowMs)) return null;

    return {
        time: Math.floor(openMs / 1_000),
        open,
        high,
        low,
        close,
        volume,
    };
};

/**
 * Fetch a single page of klines and return only closed, well-formed candles.
 * Throws when the HTTP call fails or when zero rows survive parsing.
 */
export const fetchKlinesPage = async (request: KlinesRequest, signal?: AbortSignal): Promise<BacktestCandle[]> => {
    const params = new URLSearchParams({
        symbol: request.symbol,
        interval: request.interval,
        limit: String(request.limit ?? DEFAULT_PAGE_LIMIT),
    });
    if (request.startTime !== undefined) params.set('startTime', String(request.startTime));
    if (request.endTime !== undefined) params.set('endTime', String(request.endTime));

    const url = `${BINANCE_REST_URL}${KLINES_PATH}?${params.toString()}`;
    // 8s deadline raced against the caller's signal: whichever fires first aborts the fetch.
    const timeoutSignal = AbortSignal.timeout(KLINES_TIMEOUT_MS);
    const response = await fetch(url, {
        signal: signal ? AbortSignal.any([timeoutSignal, signal]) : timeoutSignal,
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch klines (${response.status})`);
    }

    const rows = (await response.json()) as unknown[];
    const nowMs = Date.now();
    const intervalSeconds = INTERVAL_SECONDS[request.interval];
    const candles = rows
        .map((row) => parseKlineRow(row, intervalSeconds, nowMs))
        .filter((candle): candle is BacktestCandle => candle !== null);

    if (candles.length === 0) {
        throw new NoClosedCandlesError();
    }
    return candles;
};

export interface KlinesRangeRequest {
    symbol: string;
    interval: Timeframe;
    /** Bars to walk back from the latest closed bar; ignored when startTime is given. */
    lookbackBars?: number;
    startTime?: number;
    endTime?: number;
    maxCandles?: number;
}

export interface KlinesRangeResult {
    candles: BacktestCandle[];
    requests: number;
}

const HARD_PAGE_CAP = 50;
const DEFAULT_MAX_CANDLES = 20_000;
const DEFAULT_LOOKBACK_BARS = 1_000;

/**
 * Fetch a historical kline range by paging forward from `startTime` until a short page
 * or the close-time deadline is reached. Candles are deduped by open time and returned
 * strictly ascending. Throws past the hard page cap or on HTTP/abort failures, which
 * propagate from fetchKlinesPage.
 */
export const fetchKlinesRange = async (request: KlinesRangeRequest, signal?: AbortSignal): Promise<KlinesRangeResult> => {
    const intervalMs = INTERVAL_SECONDS[request.interval] * 1_000;
    const maxCandles = request.maxCandles ?? DEFAULT_MAX_CANDLES;
    // The parse predicate above is the sole unclosed-bar filter, so end at now:
    // backing off a full interval here would silently drop the freshest candle(s).
    const endMs = request.endTime ?? Date.now();
    // Window of exactly lookbackBars bars ending at endMs when no explicit start is given.
    const lookbackBars = Math.max(request.lookbackBars ?? DEFAULT_LOOKBACK_BARS, 1);
    const startMs = request.startTime ?? endMs - ((lookbackBars - 1) * intervalMs);

    const byTime = new Map<number, BacktestCandle>();
    let requests = 0;
    let cursor = startMs;

    while (byTime.size < maxCandles && cursor <= endMs) {
        if (requests >= HARD_PAGE_CAP) {
            throw new Error(`Failed to fetch klines range: exceeded hard page cap (${HARD_PAGE_CAP} requests)`);
        }
        const limit = Math.min(DEFAULT_PAGE_LIMIT, maxCandles - byTime.size);
        let page: BacktestCandle[];
        try {
            page = await fetchKlinesPage(
                { symbol: request.symbol, interval: request.interval, startTime: cursor, endTime: endMs, limit },
                signal,
            );
        } catch (error) {
            // Mid-range semantics: the sentinel means legitimate history exhaustion
            // ONLY before any candle is collected (the symbol simply lists after the
            // requested window start). Mid-range, a zero-closed-candle page means data
            // vanished inside the requested window — swallowing it would silently
            // truncate the walk, so we propagate loudly ("gaps are reported, never
            // filled"). requests === 0 ⇔ the failing call was the first request.
            if (error instanceof NoClosedCandlesError && requests === 0) break;
            throw error;
        }
        requests += 1;

        for (const candle of page) byTime.set(candle.time, candle);

        const last = page.at(-1);
        if (last === undefined || page.length < limit) break;
        cursor = last.time * 1_000 + intervalMs;
    }

    return { candles: [...byTime.values()].sort((a, b) => a.time - b.time), requests };
};

const pad2 = (value: number): string => String(value).padStart(2, '0');

/**
 * Build dataset provenance for a Binance REST fetch: UTC-stamped id, human-readable
 * name, and an FNV-1a content checksum reused from the fixture module.
 */
export const buildDatasetMeta = (
    candles: BacktestCandle[],
    symbol: string,
    interval: Timeframe,
    fetchedAt: number,
): BacktestDataset => {
    const stamp = new Date(fetchedAt);
    const stampUtc =
        `${stamp.getUTCFullYear()}${pad2(stamp.getUTCMonth() + 1)}${pad2(stamp.getUTCDate())}` +
        `${pad2(stamp.getUTCHours())}${pad2(stamp.getUTCMinutes())}`;

    return {
        id: `binance-${symbol}-${interval}-${stampUtc}-v1`,
        name: `${symbol} ${interval} Binance REST history`,
        symbol,
        interval,
        source: 'BINANCE_REST',
        checksum: checksumCandles(candles),
        candleCount: candles.length,
        startTime: candles[0]?.time ?? 0,
        endTime: candles.at(-1)?.time ?? 0,
        intervalSeconds: INTERVAL_SECONDS[interval],
        fetchedAt,
    };
};

export interface GapReport {
    gapCount: number;
    longestGapBars: number;
    missingBars: number;
}

/**
 * Detect missing bars between consecutive candles. A step larger than
 * intervalSeconds + toleranceSeconds counts as a gap; missingBars sums the
 * whole bars absent inside each gap.
 */
export const detectGaps = (candles: BacktestCandle[], intervalSeconds: number, toleranceSeconds = 5): GapReport => {
    const report: GapReport = { gapCount: 0, longestGapBars: 0, missingBars: 0 };
    for (let index = 1; index < candles.length; index += 1) {
        const deltaSeconds = candles[index]!.time - candles[index - 1]!.time;
        if (deltaSeconds <= intervalSeconds + toleranceSeconds) continue;
        const gapBars = deltaSeconds / intervalSeconds;
        report.gapCount += 1;
        report.longestGapBars = Math.max(report.longestGapBars, gapBars);
        report.missingBars += gapBars - 1;
    }
    return report;
};
