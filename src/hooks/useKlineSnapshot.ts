import { useEffect, useState } from 'react';
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

/**
 * Recent Binance klines for live signal panels, including the still-forming
 * candle. Centralizes the fetch/poll/abort/timeout/stale-guard loop that the
 * panels previously each hand-rolled, and retains the last good candles while
 * a poll fails so consumers can render a degraded state.
 */
export const useKlineSnapshot = (
    symbol: string,
    interval: string,
    limit: number,
    options: UseKlineSnapshotOptions = {},
): KlineSnapshotState => {
    const { pollMs = 0, timeoutMs = DEFAULT_TIMEOUT_MS, label = 'Kline' } = options;
    const normalizedSymbol = symbol.toUpperCase();
    const seriesKey = `${normalizedSymbol}:${interval}`;

    const [candlesState, setCandlesState] = useState<{ key: string; candles: OHLCV[] }>({
        key: '',
        candles: [],
    });
    const [errorState, setErrorState] = useState<{ key: string; message: string | null }>({
        key: '',
        message: null,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<number | null>(null);

    useEffect(() => {
        let disposed = false;
        let activeController: AbortController | null = null;
        let timedOut = false;

        const load = async () => {
            activeController?.abort();
            const controller = new AbortController();
            activeController = controller;
            timedOut = false;
            // Reset the loading flag synchronously so each poll round shows a spinner.
            setIsLoading(true);
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
        candles: candlesState.key === seriesKey ? candlesState.candles : [],
        isLoading,
        error: errorState.key === seriesKey ? errorState.message : null,
        lastUpdated,
    };
};
