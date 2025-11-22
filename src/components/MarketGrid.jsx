import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { multiAssetWS } from '../services/multiAssetWebSocket';
import { TOP_CRYPTOS } from '../data/cryptoAssets';
import { TrendingUp, TrendingDown, Search } from 'lucide-react';

/**
 * Market Grid - Bloomberg-style live watchlist
 * Shows 40+ cryptos with real-time updates
 * Standard scrolling list (optimized for <100 items)
 */
const MarketGrid = ({ onSelectSymbol }) => {
    const [marketData, setMarketData] = useState(new Map());
    const [sortBy, setSortBy] = useState('marketCap'); // marketCap, change, volume, price, name
    const [sortDir, setSortDir] = useState('desc');
    const [searchQuery, setSearchQuery] = useState('');

    // Subscribe to all symbols on mount
    useEffect(() => {
        const symbols = TOP_CRYPTOS.map(c => c.symbol);

        const handleUpdate = ({ symbol, data }) => {
            setMarketData(prev => {
                const next = new Map(prev);
                const existing = next.get(symbol) || {};

                // Merge with existing data
                next.set(symbol, {
                    ...existing,
                    ...data,
                    name: TOP_CRYPTOS.find(c => c.symbol === symbol)?.name || symbol,
                    category: TOP_CRYPTOS.find(c => c.symbol === symbol)?.category || 'Other'
                });

                return next;
            });
        };

        multiAssetWS.subscribe(symbols, handleUpdate);

        return () => {
            multiAssetWS.unsubscribe(symbols, handleUpdate);
        };
    }, []);

    // Sort and filter data
    const sortedData = useMemo(() => {
        let data = Array.from(marketData.values());

        // Filter by search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            data = data.filter(item =>
                item.name.toLowerCase().includes(query) ||
                item.symbol.toLowerCase().includes(query)
            );
        }

        // Sort
        data.sort((a, b) => {
            let aVal, bVal;

            switch (sortBy) {
                case 'name':
                    aVal = a.name;
                    bVal = b.name;
                    break;
                case 'price':
                    aVal = a.price || 0;
                    bVal = b.price || 0;
                    break;
                case 'change':
                    aVal = a.priceChangePercent || 0;
                    bVal = b.priceChangePercent || 0;
                    break;
                case 'volume':
                    aVal = a.quoteVolume || 0;
                    bVal = b.quoteVolume || 0;
                    break;
                case 'marketCap':
                    // Approximate market cap by volume (not perfect but works for sorting)
                    aVal = (a.quoteVolume || 0) * 10;
                    bVal = (b.quoteVolume || 0) * 10;
                    break;
                default:
                    aVal = 0;
                    bVal = 0;
            }

            if (typeof aVal === 'string') {
                return sortDir === 'asc'
                    ? aVal.localeCompare(bVal)
                    : bVal.localeCompare(aVal);
            }

            return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
        });

        return data;
    }, [marketData, sortBy, sortDir, searchQuery]);

    const handleSort = useCallback((column) => {
        if (sortBy === column) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortDir('desc');
        }
    }, [sortBy]);

    const formatNumber = (num, decimals = 2) => {
        if (!num) return '—';
        if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
        if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
        if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
        return `$${num.toFixed(decimals)}`;
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#000' }}>
            {/* Header */}
            <div style={{
                padding: '12px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.02)'
            }}>
                <div style={{ display: ' flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{
                        flex: 1,
                        position: 'relative'
                    }}>
                        <Search size={14} style={{
                            position: 'absolute',
                            left: '10px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--text-muted)'
                        }} />
                        <input
                            type="text"
                            placeholder="Search assets..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '8px 8px 8px 32px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '4px',
                                color: '#fff',
                                fontSize: '12px'
                            }}
                        />
                    </div>
                    <div style={{
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-mono)'
                    }}>
                        {sortedData.length} assets • Live
                    </div>
                </div>
            </div>

            {/* Column Headers */}
            <div style={{
                display: 'flex',
                padding: '8px 12px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.03)',
                fontSize: '10px',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
            }}>
                <div style={{ width: '40px' }}>#</div>
                <div
                    style={{ flex: '0 0 180px', cursor: 'pointer' }}
                    onClick={() => handleSort('name')}
                >
                    Asset {sortBy === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
                </div>
                <div
                    style={{ flex: '0 0 120px', cursor: 'pointer' }}
                    onClick={() => handleSort('price')}
                >
                    Price {sortBy === 'price' && (sortDir === 'asc' ? '↑' : '↓')}
                </div>
                <div
                    style={{ flex: '0 0 100px', cursor: 'pointer' }}
                    onClick={() => handleSort('change')}
                >
                    24h % {sortBy === 'change' && (sortDir === 'asc' ? '↑' : '↓')}
                </div>
                <div
                    style={{ flex: '0 0 100px', cursor: 'pointer' }}
                    onClick={() => handleSort('volume')}
                >
                    Volume {sortBy === 'volume' && (sortDir === 'asc' ? '↑' : '↓')}
                </div>
                <div style={{ flex: 1, textAlign: 'right' }}>Chart</div>
                <div style={{ flex: '0 0 80px', textAlign: 'right' }}>Category</div>
            </div>

            {/* Scrollable List */}
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
                {sortedData.map((item, index) => {
                    const isPositive = (item.priceChangePercent || 0) >= 0;
                    const changeColor = isPositive ? 'var(--accent-primary)' : 'var(--accent-danger)';

                    return (
                        <div
                            key={item.symbol}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '0 12px',
                                height: '50px',
                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                cursor: 'pointer',
                                background: index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                                transition: 'background 0.2s'
                            }}
                            onClick={() => onSelectSymbol && onSelectSymbol(item.symbol)}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'}
                        >
                            {/* Rank */}
                            <div style={{ width: '40px', fontSize: '11px', color: 'var(--text-muted)' }}>
                                {index + 1}
                            </div>

                            {/* Name & Symbol */}
                            <div style={{ flex: '0 0 180px', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>
                                    {item.name}
                                </div>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                    {item.symbol.replace('USDT', '')}
                                </div>
                            </div>

                            {/* Price */}
                            <div style={{ flex: '0 0 120px', fontFamily: 'var(--font-mono)', fontSize: '13px', color: '#fff' }}>
                                ${item.price?.toFixed(item.price > 1000 ? 0 : item.price > 1 ? 2 : 6) || '—'}
                            </div>

                            {/* 24h Change */}
                            <div style={{
                                flex: '0 0 100px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                color: changeColor,
                                fontFamily: 'var(--font-mono)',
                                fontSize: '13px',
                                fontWeight: '600'
                            }}>
                                {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                {isPositive ? '+' : ''}{item.priceChangePercent?.toFixed(2) || '0.00'}%
                            </div>

                            {/* 24h Volume */}
                            <div style={{
                                flex: '0 0 100px',
                                fontSize: '12px',
                                fontFamily: 'var(--font-mono)',
                                color: 'var(--text-secondary)'
                            }}>
                                {formatNumber(item.quoteVolume)}
                            </div>

                            {/* Mini Sparkline (simplified) */}
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                <div style={{
                                    width: '60px',
                                    height: '20px',
                                    background: `linear-gradient(90deg, ${changeColor}20 0%, ${changeColor}40 100%)`,
                                    borderRadius: '2px',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}>
                                    <div style={{
                                        position: 'absolute',
                                        bottom: 0,
                                        left: 0,
                                        right: 0,
                                        height: `${Math.min(Math.abs(item.priceChangePercent || 0) * 5, 100)}%`,
                                        background: changeColor,
                                        borderRadius: '2px 2px 0 0'
                                    }} />
                                </div>
                            </div>

                            {/* Category Tag */}
                            <div style={{
                                flex: '0 0 80px',
                                textAlign: 'right',
                                fontSize: '9px',
                                color: 'var(--text-muted)',
                                textTransform: 'uppercase'
                            }}>
                                {item.category}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default MarketGrid;
