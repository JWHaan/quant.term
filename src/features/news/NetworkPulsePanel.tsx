import React, { useCallback, useEffect, useState } from 'react';
import { Activity, Blocks, Gauge, RefreshCw, Timer } from 'lucide-react';

interface RecommendedFees {
    fastestFee: number;
    halfHourFee: number;
    hourFee: number;
    economyFee: number;
    minimumFee: number;
}

interface MempoolStats {
    count: number;
    vsize: number;
    total_fee: number;
}

interface FearGreedResponse {
    data?: Array<{ value: string; value_classification: string; timestamp: string }>;
}

interface NetworkPulse {
    height: number | null;
    fees: RecommendedFees | null;
    mempool: MempoolStats | null;
    sentiment: number | null;
    sentimentLabel: string;
    updatedAt: number;
}

const asFiniteNumber = (value: unknown): number | null => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const parseRecommendedFees = (value: unknown): RecommendedFees => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Malformed fee response');
    const record = value as Record<string, unknown>;
    const fees = {
        fastestFee: asFiniteNumber(record['fastestFee']),
        halfHourFee: asFiniteNumber(record['halfHourFee']),
        hourFee: asFiniteNumber(record['hourFee']),
        economyFee: asFiniteNumber(record['economyFee']),
        minimumFee: asFiniteNumber(record['minimumFee']),
    };
    if (Object.values(fees).some((fee) => fee === null || fee < 0)) throw new Error('Malformed fee response');
    return fees as RecommendedFees;
};

const parseMempoolStats = (value: unknown): MempoolStats => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Malformed mempool response');
    const record = value as Record<string, unknown>;
    const count = asFiniteNumber(record['count']);
    const vsize = asFiniteNumber(record['vsize']);
    const totalFee = asFiniteNumber(record['total_fee']);
    if (count === null || vsize === null || totalFee === null || count < 0 || vsize < 0 || totalFee < 0) {
        throw new Error('Malformed mempool response');
    }
    return { count, vsize, total_fee: totalFee };
};

const fetchWithTimeout = async (url: string, signal: AbortSignal): Promise<Response> => {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`Data provider returned ${response.status}`);
    return response;
};

const NetworkPulsePanel: React.FC = () => {
    const [pulse, setPulse] = useState<NetworkPulse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

    useEffect(() => {
        const interval = window.setInterval(refresh, 60_000);
        return () => window.clearInterval(interval);
    }, [refresh]);

    useEffect(() => {
        let disposed = false;
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 8_000);

        Promise.allSettled([
            fetchWithTimeout('https://mempool.space/api/blocks/tip/height', controller.signal).then((response) => response.text()),
            fetchWithTimeout('https://mempool.space/api/v1/fees/recommended', controller.signal)
                .then((response) => response.json() as Promise<unknown>)
                .then(parseRecommendedFees),
            fetchWithTimeout('https://mempool.space/api/mempool', controller.signal)
                .then((response) => response.json() as Promise<unknown>)
                .then(parseMempoolStats),
            fetchWithTimeout('https://api.alternative.me/fng/?limit=1&format=json', controller.signal).then((response) => response.json() as Promise<FearGreedResponse>),
        ])
            .then(([heightResult, feesResult, mempoolResult, sentimentResult]) => {
                if (disposed) return;
                const failedSources = [heightResult, feesResult, mempoolResult, sentimentResult]
                    .filter((result) => result.status === 'rejected').length;
                if (failedSources === 4) {
                    setError('All network sources are unavailable');
                    return;
                }
                const height = heightResult.status === 'fulfilled' ? Number(heightResult.value) : null;
                const sentimentPoint = sentimentResult.status === 'fulfilled'
                    ? sentimentResult.value.data?.[0]
                    : undefined;
                const sentiment = Number(sentimentPoint?.value);

                setPulse((previous) => ({
                    height: Number.isFinite(height) ? height : previous?.height ?? null,
                    fees: feesResult.status === 'fulfilled' ? feesResult.value : previous?.fees ?? null,
                    mempool: mempoolResult.status === 'fulfilled' ? mempoolResult.value : previous?.mempool ?? null,
                    sentiment: Number.isFinite(sentiment) ? sentiment : previous?.sentiment ?? null,
                    sentimentLabel: sentimentPoint?.value_classification ?? previous?.sentimentLabel ?? 'Unavailable',
                    updatedAt: Date.now(),
                }));
                setError(failedSources > 0
                    ? `${failedSources} of 4 network sources unavailable`
                    : null);
            })
            .catch((caught: unknown) => {
                if (disposed) return;
                setError(caught instanceof Error ? caught.message : 'Network metrics unavailable');
            })
            .finally(() => window.clearTimeout(timeout));

        return () => {
            disposed = true;
            window.clearTimeout(timeout);
            controller.abort();
        };
    }, [refreshKey]);

    if (!pulse && !error) return <div className="panel-state"><Activity className="spin" size={15} /> Loading live Bitcoin network data…</div>;

    if (!pulse) {
        return (
            <div className="panel-state panel-state--error">
                <span>Bitcoin network data is temporarily unavailable.</span>
                <button className="text-action" onClick={refresh}><RefreshCw size={12} /> Retry</button>
            </div>
        );
    }

    const fastestFee = pulse.fees?.fastestFee ?? null;
    const feeTone = fastestFee === null ? 'warning' : fastestFee >= 50 ? 'negative' : fastestFee >= 15 ? 'warning' : 'positive';
    const sentimentTone = pulse.sentiment === null ? 'warning' : pulse.sentiment >= 60 ? 'positive' : pulse.sentiment <= 40 ? 'negative' : 'warning';

    return (
        <section className="terminal-stack" aria-label="Live Bitcoin network pulse">
            <div className="source-line"><span className={error ? undefined : 'live-dot'} /> {error ? 'DEGRADED' : 'LIVE'} · MEMPOOL.SPACE + ALTERNATIVE.ME <button className="icon-action" onClick={refresh} aria-label="Refresh network data"><RefreshCw size={11} /></button></div>
            <div className="metric-grid metric-grid--two">
                <div className="metric-card"><Blocks size={14} /><span>Chain height</span><strong>{pulse.height?.toLocaleString() ?? '—'}</strong><small>Bitcoin mainnet</small></div>
                <div className="metric-card"><Gauge size={14} /><span>Priority fee</span><strong className={feeTone}>{fastestFee === null ? '—' : `${fastestFee} sat/vB`}</strong><small>Next-block estimate</small></div>
                <div className="metric-card"><Activity size={14} /><span>Mempool</span><strong>{pulse.mempool ? `${pulse.mempool.count.toLocaleString()} tx` : '—'}</strong><small>{pulse.mempool ? `${(pulse.mempool.vsize / 1_000_000).toFixed(1)} MvB backlog` : 'Unavailable'}</small></div>
                <div className="metric-card"><Timer size={14} /><span>Fear &amp; Greed</span><strong className={sentimentTone}>{pulse.sentiment ?? '—'}</strong><small>{pulse.sentimentLabel}</small></div>
            </div>
            <div className="fee-ladder" aria-label="Recommended Bitcoin transaction fees">
                <span><small>30 min</small><strong>{pulse.fees?.halfHourFee ?? '—'}</strong></span>
                <span><small>60 min</small><strong>{pulse.fees?.hourFee ?? '—'}</strong></span>
                <span><small>Economy</small><strong>{pulse.fees?.economyFee ?? '—'}</strong></span>
                <span><small>Minimum</small><strong>{pulse.fees?.minimumFee ?? '—'}</strong></span>
                <em>sat/vB</em>
            </div>
            <div className="freshness-line">Updated {new Date(pulse.updatedAt).toLocaleTimeString()} · {error ?? 'Public read-only sources'}</div>
        </section>
    );
};

export default NetworkPulsePanel;
