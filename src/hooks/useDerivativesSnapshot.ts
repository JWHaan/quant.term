import { useCallback, useEffect, useState } from 'react';
import { BINANCE_FUTURES_REST_URL } from '@/constants/config';
import {
    parseDerivativesSnapshot,
    type DerivativesSnapshot,
} from '@/integrations/binance/derivatives';
import { getBinanceFuturesContract } from '@/integrations/binance/contracts';

export interface DerivativesSnapshotState {
    snapshot: DerivativesSnapshot | null;
    error: string | null;
    isLoading: boolean;
    refresh: () => void;
}

const REFRESH_INTERVAL_MS = 30_000;
const FETCH_TIMEOUT_MS = 8_000;

/**
 * Polls Binance USDⓈ-M derivatives metrics for a spot symbol.
 * Shared by DerivativesPanel and MicrostructureRibbon so both never double-fetch.
 */
export function useDerivativesSnapshot(spotSymbol: string): DerivativesSnapshotState {
    const contract = getBinanceFuturesContract(spotSymbol);
    const [snapshotState, setSnapshotState] = useState<{
        symbol: string;
        snapshot: DerivativesSnapshot;
    } | null>(null);
    const [errorState, setErrorState] = useState<{ symbol: string; message: string | null }>({
        symbol: '',
        message: null,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);

    const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);

    useEffect(() => {
        const interval = window.setInterval(refresh, REFRESH_INTERVAL_MS);
        return () => window.clearInterval(interval);
    }, [refresh]);

    useEffect(() => {
        const controller = new AbortController();
        let timedOut = false;
        let disposed = false;
        // Reset the loading flag synchronously so each poll round shows a spinner.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsLoading(true);
        const timeoutId = window.setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, FETCH_TIMEOUT_MS);

        const request = async (path: string): Promise<unknown> => {
            const response = await fetch(`${BINANCE_FUTURES_REST_URL}${path}`, { signal: controller.signal });
            if (!response.ok) throw new Error(`Binance Futures returned ${response.status}`);
            return response.json() as Promise<unknown>;
        };

        Promise.all([
            request(`/fapi/v1/premiumIndex?symbol=${contract.futuresSymbol}`),
            request(`/fapi/v1/openInterest?symbol=${contract.futuresSymbol}`),
            request(`/futures/data/globalLongShortAccountRatio?symbol=${contract.futuresSymbol}&period=5m&limit=1`),
        ])
            .then(([premium, interest, ratios]) => {
                if (disposed) return;
                const next = parseDerivativesSnapshot(premium, interest, ratios, contract.futuresSymbol, contract.multiplier);
                setSnapshotState({ symbol: contract.spotSymbol, snapshot: next });
                setErrorState({ symbol: contract.spotSymbol, message: null });
            })
            .catch((caught: unknown) => {
                if (disposed || (controller.signal.aborted && !timedOut)) return;
                setErrorState({
                    symbol: contract.spotSymbol,
                    message: timedOut
                        ? 'Binance Futures request timed out'
                        : caught instanceof Error
                            ? caught.message
                            : 'Derivatives data unavailable',
                });
            })
            .finally(() => {
                window.clearTimeout(timeoutId);
                if (!disposed) setIsLoading(false);
            });

        return () => {
            disposed = true;
            window.clearTimeout(timeoutId);
            controller.abort();
        };
    }, [contract.futuresSymbol, contract.multiplier, contract.spotSymbol, refreshKey]);

    const snapshot = snapshotState?.symbol === contract.spotSymbol ? snapshotState.snapshot : null;
    const error = errorState.symbol === contract.spotSymbol ? errorState.message : null;

    return { snapshot, error, isLoading, refresh };
}
