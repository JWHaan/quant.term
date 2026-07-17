import React, { useEffect, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { formatPrice, formatVolume } from '@/utils/format';

interface DerivativesPanelProps {
    symbol: string;
}

interface PremiumIndexResponse {
    symbol: string;
    markPrice: string;
    indexPrice: string;
    lastFundingRate: string;
    nextFundingTime: number;
    time: number;
}

interface OpenInterestResponse {
    openInterest: string;
    time: number;
}

interface LongShortPoint {
    longShortRatio: string;
    longAccount: string;
    shortAccount: string;
    timestamp: number;
}

interface DerivativesSnapshot {
    markPrice: number;
    indexPrice: number;
    fundingRate: number;
    nextFundingTime: number;
    openInterest: number;
    longAccount: number;
    shortAccount: number;
    updatedAt: number;
}

const DerivativesPanel: React.FC<DerivativesPanelProps> = ({ symbol }) => {
    const [snapshot, setSnapshot] = useState<DerivativesSnapshot | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        const interval = window.setInterval(() => setRefreshKey((value) => value + 1), 30_000);
        return () => window.clearInterval(interval);
    }, [symbol]);

    useEffect(() => {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 8_000);
        const base = 'https://fapi.binance.com';
        const request = async <T,>(path: string): Promise<T> => {
            const response = await fetch(`${base}${path}`, { signal: controller.signal });
            if (!response.ok) throw new Error(`Binance Futures returned ${response.status}`);
            return response.json() as Promise<T>;
        };

        Promise.all([
            request<PremiumIndexResponse>(`/fapi/v1/premiumIndex?symbol=${symbol}`),
            request<OpenInterestResponse>(`/fapi/v1/openInterest?symbol=${symbol}`),
            request<LongShortPoint[]>(`/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=5m&limit=1`),
        ])
            .then(([premium, interest, ratios]) => {
                const ratio = ratios.at(-1);
                setSnapshot({
                    markPrice: Number(premium.markPrice),
                    indexPrice: Number(premium.indexPrice),
                    fundingRate: Number(premium.lastFundingRate),
                    nextFundingTime: premium.nextFundingTime,
                    openInterest: Number(interest.openInterest),
                    longAccount: Number(ratio?.longAccount ?? 0),
                    shortAccount: Number(ratio?.shortAccount ?? 0),
                    updatedAt: Date.now(),
                });
                setError(null);
            })
            .catch((caught: unknown) => {
                if (controller.signal.aborted) return;
                setError(caught instanceof Error ? caught.message : 'Derivatives data unavailable');
            })
            .finally(() => window.clearTimeout(timeout));

        return () => {
            window.clearTimeout(timeout);
            controller.abort();
        };
    }, [refreshKey, symbol]);

    if (!snapshot && !error) return <div className="panel-state"><Activity className="spin" size={15} /> Loading Binance USDⓈ-M data…</div>;
    if (!snapshot) return <div className="panel-state panel-state--error"><span>Derivatives metrics unavailable.</span><button className="text-action" onClick={() => setRefreshKey((value) => value + 1)}><RefreshCw size={12} /> Retry</button></div>;

    const basis = snapshot.indexPrice ? ((snapshot.markPrice / snapshot.indexPrice) - 1) * 10_000 : 0;
    const fundingPercent = snapshot.fundingRate * 100;
    const fundingTone = fundingPercent > 0 ? 'positive' : fundingPercent < 0 ? 'negative' : '';

    return (
        <section className="terminal-stack" aria-label={`${symbol} perpetual futures metrics`}>
            <div className="source-line"><span className="live-dot" /> LIVE · BINANCE USDⓈ-M PERPETUAL</div>
            <div className="metric-grid metric-grid--two">
                <div className="metric-card"><span>Mark price</span><strong>{formatPrice(snapshot.markPrice)}</strong><small>Index {formatPrice(snapshot.indexPrice)}</small></div>
                <div className="metric-card"><span>Basis</span><strong className={basis >= 0 ? 'positive' : 'negative'}>{basis >= 0 ? '+' : ''}{basis.toFixed(2)} bps</strong><small>Mark vs index</small></div>
                <div className="metric-card"><span>Funding / 8h</span><strong className={fundingTone}>{fundingPercent >= 0 ? '+' : ''}{fundingPercent.toFixed(4)}%</strong><small>Next {new Date(snapshot.nextFundingTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></div>
                <div className="metric-card"><span>Open interest</span><strong>{formatVolume(snapshot.openInterest)} {symbol.replace('USDT', '')}</strong><small>Outstanding contracts</small></div>
            </div>
            <div className="ratio-bar" aria-label={`Long accounts ${(snapshot.longAccount * 100).toFixed(1)} percent, short accounts ${(snapshot.shortAccount * 100).toFixed(1)} percent`}>
                <div style={{ width: `${snapshot.longAccount * 100}%` }} />
            </div>
            <div className="ratio-labels"><span className="positive">LONG {(snapshot.longAccount * 100).toFixed(1)}%</span><span className="negative">SHORT {(snapshot.shortAccount * 100).toFixed(1)}%</span></div>
            <div className="freshness-line">Updated {new Date(snapshot.updatedAt).toLocaleTimeString()} · Account-ratio window 5m</div>
        </section>
    );
};

export default DerivativesPanel;
