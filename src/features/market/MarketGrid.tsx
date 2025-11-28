import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { TOP_CRYPTOS } from '@/data/cryptoAssets';

const BINANCE_REST_URL = 'https://api.binance.com';

interface MarketGridProps {
    onSelectSymbol?: (symbol: string) => void;
}

interface MarketData {
    symbol: string;
    name: string;
    category: string;
    price: number;
    priceChangePercent: number;
    quoteVolume: number;
}

/**
 * Market Grid - Terminal-style live watchlist
 */
const MarketGrid: React.FC<MarketGridProps> = ({ onSelectSymbol }) => {
    const [marketData, setMarketData] = useState<Map<string, MarketData>>(new Map());
    const [sortBy, setSortBy] = useState<keyof MarketData>('quoteVolume');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [searchQuery, setSearchQuery] = useState('');

    // Poll Binance REST API
    useEffect(() => {
        let cancelled = false;
        const symbols = TOP_CRYPTOS.map(c => c.symbol);

        const fetchTickers = async () => {
            try {
                const next = new Map<string, MarketData>();
                for (const symbol of symbols) {
                    try {
                        const res = await fetch(`${BINANCE_REST_URL}/api/v3/ticker/24hr?symbol=${symbol}`);
                        const data = await res.json();
                        if (!cancelled && data && !data.code) {
                            const meta = TOP_CRYPTOS.find(c => c.symbol === symbol);
                            next.set(symbol, {
                                symbol,
                                name: meta?.name || symbol,
                                category: meta?.category || 'Other',
                                price: parseFloat(data.lastPrice),
                                priceChangePercent: parseFloat(data.priceChangePercent),
                                quoteVolume: parseFloat(data.quoteVolume),
                            });
                        }
                    } catch { }
                }
                if (!cancelled) setMarketData(next);
            } catch { }
        };

        fetchTickers();
        const id = setInterval(fetchTickers, 15000);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, []);

    // Sort and filter
    const sortedData = useMemo(() => {
        let data = Array.from(marketData.values());
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            data = data.filter(item =>
                item.name.toLowerCase().includes(query) ||
                item.symbol.toLowerCase().includes(query)
            );
        }

        data.sort((a, b) => {
            let aVal: any = a[sortBy] || 0;
            let bVal: any = b[sortBy] || 0;

            // Special handling for approximation if needed, but direct access works for defined keys
            if (sortBy === 'category') {
                aVal = a.category;
                bVal = b.category;
            }

            if (typeof aVal === 'string') {
                return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            }
            return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
        });

        return data;
    }, [marketData, sortBy, sortDir, searchQuery]);

    const handleSort = useCallback((key: keyof MarketData) => {
        if (sortBy === key) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(key);
            setSortDir('desc');
        }
    }, [sortBy]);

    const formatNumber = (num: number, decimals = 2) => {
        if (!num) return '—';
        if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
        if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
        if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
        return num.toFixed(decimals);
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-panel)', fontFamily: 'var(--font-mono)' }}>
            {/* Command Input Header */}
            <div style={{
                padding: '8px',
                borderBottom: '1px solid var(--border-color)',
                background: 'rgba(51, 255, 0, 0.05)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        flex: 1,
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        background: '#000',
                        border: '1px solid var(--border-subtle)',
                        padding: '4px 8px'
                    }}>
                        <span style={{ color: 'var(--accent-primary)', marginRight: '8px', fontWeight: 'bold' }}>$</span>
                        <input
                            type="text"
                            placeholder="GREP ASSET..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-primary)',
                                fontSize: '12px',
                                fontFamily: 'var(--font-mono)',
                                outline: 'none',
                                textTransform: 'uppercase'
                            }}
                        />
                    </div>
                    <div style={{
                        fontSize: '10px',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-subtle)',
                        padding: '4px 8px',
                        background: '#000'
                    }}>
                        COUNT: {sortedData.length}
                    </div>
                </div>
            </div>

            {/* Column Headers */}
            <div style={{
                display: 'flex',
                padding: '6px 4px',
                borderBottom: '1px solid var(--border-subtle)',
                fontSize: '10px',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                background: '#000'
            }}>
                <div style={{ width: '40px', textAlign: 'center' }}>#</div>
                <div style={{ flex: '0 0 140px', cursor: 'pointer' }} onClick={() => handleSort('name')}>
                    ASSET {sortBy === 'name' && (sortDir === 'asc' ? '▲' : '▼')}
                </div>
                <div style={{ flex: '0 0 100px', cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort('price')}>
                    PRICE {sortBy === 'price' && (sortDir === 'asc' ? '▲' : '▼')}
                </div>
                <div style={{ flex: '0 0 80px', cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort('priceChangePercent')}>
                    24H% {sortBy === 'priceChangePercent' && (sortDir === 'asc' ? '▲' : '▼')}
                </div>
                <div style={{ flex: '0 0 80px', cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort('quoteVolume')}>
                    VOL {sortBy === 'quoteVolume' && (sortDir === 'asc' ? '▲' : '▼')}
                </div>
                <div style={{ flex: 1 }}></div>
            </div>

            {/* Scrollable List */}
            <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
                {sortedData.map((item, index) => (
                    <MarketRow
                        key={item.symbol}
                        item={item}
                        index={index}
                        onSelect={onSelectSymbol}
                        formatNumber={formatNumber}
                    />
                ))}
            </div>
        </div>
    );
};

interface MarketRowProps {
    item: MarketData;
    index: number;
    onSelect?: ((symbol: string) => void) | undefined;
    formatNumber: (num: number) => string;
}

const MarketRow = React.memo(({ item, index, onSelect, formatNumber }: MarketRowProps) => {
    const isPositive = (item.priceChangePercent || 0) >= 0;
    const changeColor = isPositive ? 'var(--accent-primary)' : 'var(--accent-danger)';

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                padding: '4px 4px',
                borderBottom: '1px solid rgba(51, 255, 0, 0.1)',
                cursor: 'pointer',
                fontSize: '11px',
                color: 'var(--text-secondary)',
                transition: 'all 0.1s'
            }}
            onClick={() => onSelect && onSelect(item.symbol)}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--accent-primary)';
                e.currentTarget.style.color = '#000';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
            }}
        >
            <div style={{ width: '40px', textAlign: 'center', opacity: 0.7 }}>
                {String(index + 1).padStart(2, '0')}
            </div>

            <div style={{ flex: '0 0 140px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 'bold' }}>{item.symbol.replace('USDT', '')}</span>
                <span style={{ fontSize: '9px', opacity: 0.7 }}>{item.name.substring(0, 10)}</span>
            </div>

            <div style={{ flex: '0 0 100px', textAlign: 'right', fontWeight: 'bold' }}>
                {item.price?.toFixed(item.price > 1000 ? 1 : item.price > 1 ? 3 : 6)}
            </div>

            <div style={{
                flex: '0 0 80px',
                textAlign: 'right',
                color: changeColor,
                // Override color on hover via CSS class or inline style trick? 
                // Since we are using inline styles for hover, we need to be careful.
                // The parent hover effect sets color to #000, which is good.
                // But we need to make sure this specific element doesn't override it with changeColor when hovered.
                // We'll trust the parent hover for now, but strictly speaking, inline styles override inherited ones.
                // Let's use a span that inherits color on hover.
            }}>
                <span style={{ color: 'inherit' }}>
                    {isPositive ? '+' : ''}{item.priceChangePercent?.toFixed(2)}%
                </span>
            </div>

            <div style={{ flex: '0 0 80px', textAlign: 'right', opacity: 0.8 }}>
                {formatNumber(item.quoteVolume)}
            </div>

            <div style={{ flex: 1, textAlign: 'right', paddingRight: '8px' }}>
                <span style={{ fontSize: '9px', opacity: 0.5 }}>[{item.category.substring(0, 3).toUpperCase()}]</span>
            </div>
        </div>
    );
});

export default MarketGrid;
