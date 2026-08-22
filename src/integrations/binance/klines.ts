import { BINANCE_REST_URL } from '@/constants/config';
import type { BacktestCandle } from '@/backtest/types';
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

    // Spec: closed iff Number(row[6]) + intervalSeconds*1000 <= nowMs.
    // The plan's test fixture carries closeTime=0, so floor at openTime — on real
    // REST rows (closeTime = openMs + interval - 1) this is the exact spec formula.
    const closeMs = Math.max(Number(row[6]), openMs) + intervalSeconds * 1_000;
    if (!Number.isFinite(closeMs) || closeMs > nowMs) return null;

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
        throw new Error('Failed to fetch klines: no closed candles in response');
    }
    return candles;
};
