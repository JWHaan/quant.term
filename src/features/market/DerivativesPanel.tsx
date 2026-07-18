import React, { useEffect, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { BINANCE_FUTURES_REST_URL } from '@/constants/config';
import { parseDerivativesSnapshot, type DerivativesSnapshot } from '@/services/binanceDerivatives';
import { formatPrice, formatVolume } from '@/utils/format';
import { getBinanceFuturesContract } from '@/utils/binanceFutures';

interface DerivativesPanelProps {
    symbol: string;
}

const DerivativesPanel: React.FC<DerivativesPanelProps> = ({ symbol }) => {
    const contract = getBinanceFuturesContract(symbol);
    const [snapshotState, setSnapshotState] = useState<{
        symbol: string;
        snapshot: DerivativesSnapshot;
    } | null>(null);
    const [errorState, setErrorState] = useState<{ symbol: string; message: string | null }>({
        symbol: '',
        message: null,
    });
    const [refreshKey, setRefreshKey] = useState(0);
    const snapshot = snapshotState?.symbol === contract.spotSymbol ? snapshotState.snapshot : null;
    const error = errorState.symbol === contract.spotSymbol ? errorState.message : null;

    useEffect(() => {
        const interval = window.setInterval(() => setRefreshKey((value) => value + 1), 30_000);
        return () => window.clearInterval(interval);
    }, [contract.spotSymbol]);

    useEffect(() => {
        const controller = new AbortController();
        let timedOut = false;
        const request = async (path: string): Promise<unknown> => {
            const response = await fetch(`${BINANCE_FUTURES_REST_URL}${path}`, { signal: controller.signal });
            if (!response.ok) throw new Error(`Binance Futures returned ${response.status}`);
            return response.json() as Promise<unknown>;
        };

        const timeoutId = window.setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, 8_000);

        Promise.all([
            request(`/fapi/v1/premiumIndex?symbol=${contract.futuresSymbol}`),
            request(`/fapi/v1/openInterest?symbol=${contract.futuresSymbol}`),
            request(`/futures/data/globalLongShortAccountRatio?symbol=${contract.futuresSymbol}&period=5m&limit=1`),
        ])
            .then(([premium, interest, ratios]) => {
                const nextSnapshot = parseDerivativesSnapshot(
                    premium,
                    interest,
                    ratios,
                    contract.futuresSymbol,
                    contract.multiplier,
                );
                setSnapshotState({
                    symbol: contract.spotSymbol,
                    snapshot: nextSnapshot,
                });
                setErrorState({ symbol: contract.spotSymbol, message: null });
            })
            .catch((caught: unknown) => {
                if (controller.signal.aborted && !timedOut) return;
                setErrorState({
                    symbol: contract.spotSymbol,
                    message: timedOut
                        ? 'Binance Futures request timed out'
                        : caught instanceof Error
                            ? caught.message
                            : 'Derivatives data unavailable',
                });
            })
            .finally(() => window.clearTimeout(timeoutId));

        return () => {
            window.clearTimeout(timeoutId);
            controller.abort();
        };
    }, [contract.futuresSymbol, contract.multiplier, contract.spotSymbol, refreshKey]);

    if (!snapshot && !error) return <div className="panel-state"><Activity className="spin" size={15} /> Loading Binance USDⓈ-M data…</div>;
    if (!snapshot) return <div className="panel-state panel-state--error"><span>Derivatives metrics unavailable{error ? ` · ${error}` : ''}.</span><button className="text-action" onClick={() => setRefreshKey((value) => value + 1)}><RefreshCw size={12} /> Retry</button></div>;

    const basis = snapshot.indexPrice ? ((snapshot.markPrice / snapshot.indexPrice) - 1) * 10_000 : 0;
    const fundingPercent = snapshot.fundingRate * 100;
    const fundingTone = fundingPercent > 0 ? 'positive' : fundingPercent < 0 ? 'negative' : '';

    return (
        <section className="terminal-stack" aria-label={`${contract.spotSymbol} perpetual futures metrics`}>
            <div className={`source-line ${error ? 'warning' : ''}`} role="status">
                <span className={error ? '' : 'live-dot'} aria-hidden="true">{error ? '▲' : ''}</span>
                {error ? 'DEGRADED' : 'LIVE'} · BINANCE USDⓈ-M · {contract.futuresSymbol}
                {error && <button className="text-action" onClick={() => setRefreshKey((value) => value + 1)}><RefreshCw size={12} /> Retry</button>}
            </div>
            <div className="metric-grid metric-grid--two">
                <div className="metric-card"><span>Mark price</span><strong>{formatPrice(snapshot.markPrice)}</strong><small>Index {formatPrice(snapshot.indexPrice)}</small></div>
                <div className="metric-card"><span>Basis</span><strong className={basis >= 0 ? 'positive' : 'negative'}>{basis >= 0 ? '+' : ''}{basis.toFixed(2)} bps</strong><small>Mark vs index</small></div>
                <div className="metric-card"><span>Funding / 8h</span><strong className={fundingTone}>{fundingPercent >= 0 ? '+' : ''}{fundingPercent.toFixed(4)}%</strong><small>Next {new Date(snapshot.nextFundingTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></div>
                <div className="metric-card"><span>Open interest</span><strong>{formatVolume(snapshot.openInterest)} {contract.spotSymbol.replace('USDT', '')}</strong><small>{contract.multiplier > 1 ? `Normalized from ${contract.futuresSymbol}` : 'Outstanding contracts'}</small></div>
            </div>
            <div className="ratio-bar" aria-label={`Long accounts ${(snapshot.longAccount * 100).toFixed(1)} percent, short accounts ${(snapshot.shortAccount * 100).toFixed(1)} percent`}>
                <div style={{ width: `${snapshot.longAccount * 100}%` }} />
            </div>
            <div className="ratio-labels"><span className="positive">LONG {(snapshot.longAccount * 100).toFixed(1)}%</span><span className="negative">SHORT {(snapshot.shortAccount * 100).toFixed(1)}%</span></div>
            <div className={`freshness-line ${error ? 'warning' : ''}`}>
                Last successful update {new Date(snapshot.updatedAt).toLocaleTimeString()} · Account-ratio window 5m{error ? ` · Refresh failed: ${error}` : ''}
            </div>
        </section>
    );
};

export default DerivativesPanel;
