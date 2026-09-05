import { useEffect, useRef, useState } from 'react';
import { fetchKlinesSnapshot } from '@/integrations/binance/klines';
import type { OHLCV } from '@/types/common';

export interface UseKlineSnapshotOptions {
    /** Poll interval in milliseconds; 0 (default) fetches once per parameter change. */
    pollMs?: number;
    /** Per-request deadline in milliseconds. */
    timeoutMs?: number;
    /** Human-facing label used in the timeout message, e.g. 'Signal'. */
    label?: string;
}

export interface KlineSnapshotState {
    candles: OHLCV[];
    isLoading: boolean;
    error: string | null;
    lastUpdated: number | null;
}

const DEFAULT_TIMEOUT_MS = 8_000;
const EMPTY_CANDLES: OHLCV[] = [];

/**
 * Recent Binance klines for live signal panels, including the still-forming
 * candle. Centralizes the fetch/poll/abort/timeout/stale-guard loop that the
 * panels previously each hand-rolled, and retains the last good candles while
 * a poll fails so consumers can render a degraded state. `isLoading` only
 * covers the wait for a series' first data; background refreshes of existing
 * data leave it false so consumers never blank retained content.
 */
export const useKlineSnapshot = (
    symbol: string,
    interval: string,
    limit: number,
    options: UseKlineSnapshotOptions = {},
): KlineSnapshotState => {
    const { pollMs = 0, timeoutMs = DEFAULT_TIMEOUT_MS, label = 'Kline' } = options;
    const normalizedSymbol = symbol.toUpperCase();
    const seriesKey = `${normalizedSymbol}:${interval}:${limit}`;

    const [candlesState, setCandlesState] = useState<{ key: string; candles: OHLCV[] }>({
        key: '',
        candles: EMPTY_CANDLES,
    });
    const [errorState, setErrorState] = useState<{ key: string; message: string | null }>({
        key: '',
        message: null,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<number | null>(null);
    const dataKeyRef = useRef('');

    useEffect(() => {
        let disposed = false;
        let activeController: AbortController | null = null;
        let timedOut = false;

        const load = async () => {
            activeController?.abort();
            const controller = new AbortController();
            activeController = controller;
            timedOut = false;
            // Only the first wait for a series shows a spinner; refresh rounds
            // keep previously rendered candles on screen.
            if (dataKeyRef.current !== seriesKey) {
                setIsLoading(true);
            }
            const timeoutId = window.setTimeout(() => {
                timedOut = true;
                controller.abort();
            }, timeoutMs);

            try {
                const rows = await fetchKlinesSnapshot(
                    { symbol: normalizedSymbol, interval, limit },
                    controller.signal,
                );
                if (disposed || activeController !== controller) return;

                dataKeyRef.current = seriesKey;
                setCandlesState({ key: seriesKey, candles: rows });
                setErrorState({ key: seriesKey, message: null });
                setLastUpdated(Date.now());
            } catch (caught: unknown) {
                if (disposed || activeController !== controller) return;
                if (controller.signal.aborted && !timedOut) return;

                setErrorState({
                    key: seriesKey,
                    message: timedOut
                        ? `${label} request timed out`
                        : caught instanceof Error
                            ? caught.message
                            : `${label} data unavailable`,
                });
            } finally {
                window.clearTimeout(timeoutId);
                if (!disposed && activeController === controller) setIsLoading(false);
            }
        };

        void load();
        const pollTimer = pollMs > 0 ? window.setInterval(() => { void load(); }, pollMs) : null;

        return () => {
            disposed = true;
            if (pollTimer) window.clearInterval(pollTimer);
            activeController?.abort();
        };
    }, [interval, label, limit, normalizedSymbol, pollMs, seriesKey, timeoutMs]);

    return {
        candles: candlesState.key === seriesKey ? candlesState.candles : EMPTY_CANDLES,
        isLoading,
        error: errorState.key === seriesKey ? errorState.message : null,
        lastUpdated,
    };
};
