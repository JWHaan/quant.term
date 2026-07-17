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
    height: number;
    fees: RecommendedFees;
    mempool: MempoolStats;
    sentiment: number;
    sentimentLabel: string;
    updatedAt: number;
}

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
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 8_000);

        Promise.all([
            fetchWithTimeout('https://mempool.space/api/blocks/tip/height', controller.signal).then((response) => response.text()),
            fetchWithTimeout('https://mempool.space/api/v1/fees/recommended', controller.signal).then((response) => response.json() as Promise<RecommendedFees>),
            fetchWithTimeout('https://mempool.space/api/mempool', controller.signal).then((response) => response.json() as Promise<MempoolStats>),
            fetchWithTimeout('https://api.alternative.me/fng/?limit=1&format=json', controller.signal).then((response) => response.json() as Promise<FearGreedResponse>),
        ])
            .then(([height, fees, mempool, sentiment]) => {
                const sentimentPoint = sentiment.data?.[0];
                setPulse({
                    height: Number(height),
                    fees,
                    mempool,
                    sentiment: Number(sentimentPoint?.value ?? 0),
                    sentimentLabel: sentimentPoint?.value_classification ?? 'Unavailable',
                    updatedAt: Date.now(),
                });
                setError(null);
            })
            .catch((caught: unknown) => {
                if (controller.signal.aborted) return;
                setError(caught instanceof Error ? caught.message : 'Network metrics unavailable');
            })
            .finally(() => window.clearTimeout(timeout));

        return () => {
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

    const feeTone = pulse.fees.fastestFee >= 50 ? 'negative' : pulse.fees.fastestFee >= 15 ? 'warning' : 'positive';
    const sentimentTone = pulse.sentiment >= 60 ? 'positive' : pulse.sentiment <= 40 ? 'negative' : 'warning';

    return (
        <section className="terminal-stack" aria-label="Live Bitcoin network pulse">
            <div className="source-line"><span className="live-dot" /> LIVE · MEMPOOL.SPACE + ALTERNATIVE.ME <button className="icon-action" onClick={refresh} aria-label="Refresh network data"><RefreshCw size={11} /></button></div>
            <div className="metric-grid metric-grid--two">
                <div className="metric-card"><Blocks size={14} /><span>Chain height</span><strong>{pulse.height.toLocaleString()}</strong><small>Bitcoin mainnet</small></div>
                <div className="metric-card"><Gauge size={14} /><span>Priority fee</span><strong className={feeTone}>{pulse.fees.fastestFee} sat/vB</strong><small>Next-block estimate</small></div>
                <div className="metric-card"><Activity size={14} /><span>Mempool</span><strong>{pulse.mempool.count.toLocaleString()} tx</strong><small>{(pulse.mempool.vsize / 1_000_000).toFixed(1)} MvB backlog</small></div>
                <div className="metric-card"><Timer size={14} /><span>Fear &amp; Greed</span><strong className={sentimentTone}>{pulse.sentiment}</strong><small>{pulse.sentimentLabel}</small></div>
            </div>
            <div className="fee-ladder" aria-label="Recommended Bitcoin transaction fees">
                <span><small>30 min</small><strong>{pulse.fees.halfHourFee}</strong></span>
                <span><small>60 min</small><strong>{pulse.fees.hourFee}</strong></span>
                <span><small>Economy</small><strong>{pulse.fees.economyFee}</strong></span>
                <span><small>Minimum</small><strong>{pulse.fees.minimumFee}</strong></span>
                <em>sat/vB</em>
            </div>
            <div className="freshness-line">Updated {new Date(pulse.updatedAt).toLocaleTimeString()} · Public read-only sources</div>
        </section>
    );
};

export default NetworkPulsePanel;
