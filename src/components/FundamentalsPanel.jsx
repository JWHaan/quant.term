import React from 'react';
import { useFundamentals } from '../hooks/useFundamentals';
import { TrendingUp, TrendingDown } from 'lucide-react';

const FundamentalsPanel = React.memo(({ symbol }) => {
    const fundamentals = useFundamentals(symbol);

    const formatNumber = (num) => {
        if (num === null || num === undefined) return 'N/A';
        if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
        if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
        if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
        return `$${num.toFixed(2)}`;
    };

    const formatSupply = (num) => {
        if (num === null || num === undefined) return 'N/A';
        if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
        if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
        return num.toLocaleString();
    };

    if (fundamentals.loading) {
        return (
            <div style={{ padding: '20px', textAlign: 'center' }}>
                <div className="skeleton" style={{ width: '100%', height: '20px', marginBottom: '10px' }} />
                <div className="skeleton" style={{ width: '80%', height: '20px', marginBottom: '10px' }} />
                <div className="skeleton" style={{ width: '90%', height: '20px' }} />
            </div>
        );
    }

    if (fundamentals.error) {
        return (
            <div style={{ padding: '20px', color: 'var(--accent-danger)', textAlign: 'center' }}>
                <p>Failed to load fundamental data</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{fundamentals.error}</p>
            </div>
        );
    }

    const MetricRow = ({ label, value, change, isPercentage = false }) => (
        <div className="smooth-transition" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 12px',
            borderBottom: '1px solid var(--border-color)',
            fontSize: '12px',
            cursor: 'default'
        }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
            <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', color: '#fff' }}>{value}</span>
                {change !== undefined && change !== null && (
                    <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        color: change >= 0 ? 'var(--accent-primary)' : 'var(--accent-danger)',
                        fontSize: '11px'
                    }}>
                        {change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {Math.abs(change).toFixed(2)}%
                    </span>
                )}
            </div>
        </div>
    );

    return (
        <div style={{ height: '100%', overflow: 'auto', fontFamily: 'var(--font-ui)' }}>
            {/* Key Metrics */}
            <div style={{
                padding: '8px 12px',
                background: 'rgba(0,0,0,0.3)',
                borderBottom: '2px solid var(--border-color)',
                fontSize: '11px',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                fontWeight: '600'
            }}>
                Market Metrics
            </div>

            <MetricRow
                label="Market Cap"
                value={formatNumber(fundamentals.marketCap)}
            />
            <MetricRow
                label="24h Volume"
                value={formatNumber(fundamentals.volume24h)}
            />
            <MetricRow
                label="Vol/MCap Ratio"
                value={(fundamentals.volumeToMarketCap * 100).toFixed(2) + '%'}
            />
            <MetricRow
                label="Market Rank"
                value={`#${fundamentals.marketCapRank || 'N/A'}`}
            />

            {/* Supply Metrics */}
            <div style={{
                padding: '8px 12px',
                background: 'rgba(0,0,0,0.3)',
                borderBottom: '2px solid var(--border-color)',
                fontSize: '11px',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                fontWeight: '600',
                marginTop: '12px'
            }}>
                Supply Data
            </div>

            <MetricRow
                label="Circulating"
                value={formatSupply(fundamentals.circulatingSupply)}
            />
            <MetricRow
                label="Total Supply"
                value={formatSupply(fundamentals.totalSupply)}
            />
            <MetricRow
                label="Max Supply"
                value={formatSupply(fundamentals.maxSupply)}
            />

            {/* Price Extremes */}
            <div style={{
                padding: '8px 12px',
                background: 'rgba(0,0,0,0.3)',
                borderBottom: '2px solid var(--border-color)',
                fontSize: '11px',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                fontWeight: '600',
                marginTop: '12px'
            }}>
                Historical Extremes
            </div>

            <MetricRow
                label="All-Time High"
                value={formatNumber(fundamentals.ath)}
                change={fundamentals.athChangePercentage}
            />
            <MetricRow
                label="All-Time Low"
                value={formatNumber(fundamentals.atl)}
                change={fundamentals.atlChangePercentage}
            />

            {/* 24h Change */}
            <div style={{
                margin: '12px',
                padding: '12px',
                background: fundamentals.priceChangePercentage24h >= 0
                    ? 'rgba(0, 255, 157, 0.1)'
                    : 'rgba(255, 0, 85, 0.1)',
                border: `1px solid ${fundamentals.priceChangePercentage24h >= 0
                    ? 'var(--accent-primary)'
                    : 'var(--accent-danger)'}`,
                borderRadius: '4px'
            }}>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    24H CHANGE
                </div>
                <div style={{
                    fontSize: '18px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: '600',
                    color: fundamentals.priceChangePercentage24h >= 0
                        ? 'var(--accent-primary)'
                        : 'var(--accent-danger)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    {fundamentals.priceChangePercentage24h >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                    {fundamentals.priceChangePercentage24h?.toFixed(2)}%
                </div>
            </div>
        </div>
    );
});

export default FundamentalsPanel;
