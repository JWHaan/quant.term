import React from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { formatPrice, formatVolume, formatBps } from '@/utils/format';
import { useDerivativesSnapshot } from '@/hooks/useDerivativesSnapshot';
import { getBinanceFuturesContract } from '@/integrations/binance/contracts';

interface DerivativesPanelProps {
    symbol: string;
}

const DerivativesPanel: React.FC<DerivativesPanelProps> = ({ symbol }) => {
    const contract = getBinanceFuturesContract(symbol);
    const { snapshot, error, refresh } = useDerivativesSnapshot(symbol);

    if (!snapshot && !error) return <div className="panel-state"><Activity className="spin" size={15} /> Loading Binance USDⓈ-M data…</div>;
    if (!snapshot) return <div className="panel-state panel-state--error"><span>Derivatives metrics unavailable{error ? ` · ${error}` : ''}.</span><button className="text-action" onClick={refresh}><RefreshCw size={12} /> Retry</button></div>;

    const basis = snapshot.indexPrice ? ((snapshot.markPrice / snapshot.indexPrice) - 1) * 10_000 : 0;

    return (
        <section className="terminal-stack" aria-label={`${contract.spotSymbol} perpetual futures metrics`}>
            <div className={`source-line ${error ? 'warning' : ''}`} role="status">
                <span className={error ? '' : 'live-dot'} aria-hidden="true">{error ? '▲' : ''}</span>
                {error ? 'DEGRADED' : 'LIVE'} · BINANCE USDⓈ-M · {contract.futuresSymbol}
                {error && <button className="text-action" onClick={refresh}><RefreshCw size={12} /> Retry</button>}
            </div>
            <div className="metric-grid metric-grid--two">
                <div className="metric-card"><span>Mark price</span><strong>{formatPrice(snapshot.markPrice)}</strong><small>Index {formatPrice(snapshot.indexPrice)}</small></div>
                <div className="metric-card"><span>Basis</span><strong className={basis >= 0 ? 'positive' : 'negative'}>{basis >= 0 ? '+' : ''}{basis.toFixed(2)} bps</strong><small>Mark vs index</small></div>
                <div className="metric-card"><span>Funding / 8h</span><strong className={snapshot.fundingRate >= 0 ? 'positive' : 'negative'}>{formatBps(snapshot.fundingRate * 10_000)}</strong><small>Next {new Date(snapshot.nextFundingTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></div>
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
