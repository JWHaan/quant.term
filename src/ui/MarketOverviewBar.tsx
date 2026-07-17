import React, { useEffect, useState } from 'react';
import { Activity, Database, TrendingDown, TrendingUp } from 'lucide-react';
import { useCheckMarketConditions } from '@/stores/alertStore';
import { useMarketData } from '@/stores/marketStore';
import { formatPercent, formatPrice, formatVolume } from '@/utils/format';

interface MarketOverviewBarProps {
    symbol: string;
    isConnected: boolean;
}

const MarketOverviewBar: React.FC<MarketOverviewBarProps> = ({ symbol, isConnected }) => {
    const market = useMarketData(symbol);
    const checkMarketConditions = useCheckMarketConditions();
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const interval = window.setInterval(() => setNow(Date.now()), 1_000);
        return () => window.clearInterval(interval);
    }, []);

    useEffect(() => {
        if (market && Number.isFinite(market.price)) {
            checkMarketConditions({ symbol, price: market.price });
        }
    }, [checkMarketConditions, market, symbol]);

    const age = market?.timestamp ? Math.max(0, now - market.timestamp) : null;
    const stale = age === null || age > 10_000;
    const positive = (market?.priceChangePercent ?? 0) >= 0;

    return (
        <section className="market-overview" aria-label={`${symbol} live market overview`}>
            <div className="instrument-identity">
                <span className="instrument-venue">BINANCE SPOT</span>
                <strong>{symbol.replace('USDT', '')}<em>/USDT</em></strong>
                <span className={`feed-chip ${isConnected && !stale ? 'feed-chip--live' : ''}`}>
                    <span /> {isConnected && !stale ? 'LIVE' : stale ? 'STALE' : 'CONNECTING'}
                </span>
            </div>
            <div className="instrument-price">
                <strong>{market ? formatPrice(market.price) : '—'}</strong>
                <span className={positive ? 'positive' : 'negative'}>
                    {positive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                    {market ? formatPercent(market.priceChangePercent) : '—'}
                </span>
            </div>
            <div className="overview-metrics" role="list">
                <div role="listitem"><span>24H HIGH</span><strong>{market ? formatPrice(market.high) : '—'}</strong></div>
                <div role="listitem"><span>24H LOW</span><strong>{market ? formatPrice(market.low) : '—'}</strong></div>
                <div role="listitem"><span>24H VOLUME</span><strong>{market ? `$${formatVolume(market.quoteVolume)}` : '—'}</strong></div>
                <div role="listitem"><span>BASE VOLUME</span><strong>{market ? formatVolume(market.volume) : '—'}</strong></div>
            </div>
            <div className="overview-source">
                {stale ? <Activity size={12} /> : <Database size={12} />}
                <span>{age === null ? 'Awaiting first tick' : age < 1_000 ? 'Updated now' : `Updated ${Math.floor(age / 1_000)}s ago`}</span>
            </div>
        </section>
    );
};

export default MarketOverviewBar;
