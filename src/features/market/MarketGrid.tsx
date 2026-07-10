import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { TOP_CRYPTOS } from '@/data/cryptoAssets';
import { formatPrice, formatVolume, formatPercent } from '@/utils/format';
import { BINANCE_REST_URL, MARKET_POLL_INTERVAL_MS } from '@/constants/config';

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

type SortKey = keyof MarketData;

/**
 * MarketGrid — Terminal-style live watchlist.
 * Polls Binance REST every 15s and renders a sortable, searchable ticker list.
 */
const MarketGrid: React.FC<MarketGridProps> = ({ onSelectSymbol }) => {
    const [marketData, setMarketData] = useState<Map<string, MarketData>>(new Map());
    const [sortBy, setSortBy] = useState<SortKey>('quoteVolume');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        let cancelled = false;
        const symbols = TOP_CRYPTOS.map(c => c.symbol);

        const fetchTickers = async () => {
            try {
                const next = new Map<string, MarketData>();
                await Promise.allSettled(
                    symbols.map(async (symbol) => {
                        const res = await fetch(`${BINANCE_REST_URL}/api/v3/ticker/24hr?symbol=${symbol}`);
                        const data = await res.json() as Record<string, string>;
                        if (!data || data['code']) return;
                        const meta = TOP_CRYPTOS.find(c => c.symbol === symbol);
                        next.set(symbol, {
                            symbol,
                            name: meta?.name ?? symbol,
                            category: meta?.category ?? 'Other',
                            price: parseFloat(data['lastPrice'] ?? '0'),
                            priceChangePercent: parseFloat(data['priceChangePercent'] ?? '0'),
                            quoteVolume: parseFloat(data['quoteVolume'] ?? '0'),
                        });
                    })
                );
                if (!cancelled) setMarketData(next);
            } catch {
                // Network errors are non-fatal; data will refresh on next poll
            }
        };

        fetchTickers();
        const id = setInterval(fetchTickers, MARKET_POLL_INTERVAL_MS);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, []);

    const sortedData = useMemo(() => {
        let data = Array.from(marketData.values());

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            data = data.filter(item =>
                item.name.toLowerCase().includes(q) ||
                item.symbol.toLowerCase().includes(q)
            );
        }

        data.sort((a, b) => {
            const aVal = a[sortBy];
            const bVal = b[sortBy];
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            }
            const aNum = aVal as number;
            const bNum = bVal as number;
            return sortDir === 'asc' ? aNum - bNum : bNum - aNum;
        });

        return data;
    }, [marketData, sortBy, sortDir, searchQuery]);

    const handleSort = useCallback((key: SortKey) => {
        setSortBy(prev => {
            if (prev === key) {
                setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                return prev;
            }
            setSortDir('desc');
            return key;
        });
    }, []);

    const SortIndicator = ({ col }: { col: SortKey }) =>
        sortBy === col ? <span>{sortDir === 'asc' ? ' ▲' : ' ▼'}</span> : null;

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-panel)', fontFamily: 'var(--font-mono)' }}>
            {/* Search Bar */}
            <div style={{ padding: '8px', borderBottom: '1px solid var(--border-color)', background: 'rgba(51, 255, 0, 0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', background: '#000', border: '1px solid var(--border-subtle)', padding: '4px 8px' }}>
                        <span style={{ color: 'var(--accent-primary)', marginRight: '8px', fontWeight: 'bold' }}>$</span>
                        <input
                            type="text"
                            placeholder="GREP ASSET..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '12px', fontFamily: 'var(--font-mono)', outline: 'none', textTransform: 'uppercase' }}
                        />
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', padding: '4px 8px', background: '#000' }}>
                        COUNT: {sortedData.length}
                    </div>
                </div>
            </div>

            {/* Column Headers */}
            <div style={{ display: 'flex', padding: '6px 4px', borderBottom: '1px solid var(--border-subtle)', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', background: '#000' }}>
                <div style={{ width: '40px', textAlign: 'center' }}>#</div>
                <div style={{ flex: '0 0 140px', cursor: 'pointer' }} onClick={() => handleSort('name')}>ASSET<SortIndicator col="name" /></div>
                <div style={{ flex: '0 0 100px', cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort('price')}>PRICE<SortIndicator col="price" /></div>
                <div style={{ flex: '0 0 80px', cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort('priceChangePercent')}>24H%<SortIndicator col="priceChangePercent" /></div>
                <div style={{ flex: '0 0 80px', cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort('quoteVolume')}>VOL<SortIndicator col="quoteVolume" /></div>
                <div style={{ flex: 1 }} />
            </div>

            {/* Ticker List */}
            <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
                {sortedData.map((item, index) => (
                    <MarketRow
                        key={item.symbol}
                        item={item}
                        index={index}
                        onSelect={onSelectSymbol}
                    />
                ))}
            </div>
        </div>
    );
};

interface MarketRowProps {
    item: MarketData;
    index: number;
    onSelect?: (symbol: string) => void;
}

const MarketRow = React.memo(({ item, index, onSelect }: MarketRowProps) => {
    const isPositive = (item.priceChangePercent ?? 0) >= 0;
    const changeColor = isPositive ? 'var(--accent-primary)' : 'var(--accent-danger)';

    return (
        <div
            style={{ display: 'flex', alignItems: 'center', padding: '4px 4px', borderBottom: '1px solid rgba(51, 255, 0, 0.1)', cursor: 'pointer', fontSize: '11px', color: 'var(--text-secondary)', transition: 'all 0.1s' }}
            onClick={() => onSelect?.(item.symbol)}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-primary)'; e.currentTarget.style.color = '#000'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
            <div style={{ width: '40px', textAlign: 'center', opacity: 0.7 }}>
                {String(index + 1).padStart(2, '0')}
            </div>
            <div style={{ flex: '0 0 140px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 'bold' }}>{item.symbol.replace('USDT', '')}</span>
                <span style={{ fontSize: '9px', opacity: 0.7 }}>{item.name.substring(0, 10)}</span>
            </div>
            <div style={{ flex: '0 0 100px', textAlign: 'right', fontWeight: 'bold' }}>
                {formatPrice(item.price)}
            </div>
            <div style={{ flex: '0 0 80px', textAlign: 'right', color: changeColor }}>
                {formatPercent(item.priceChangePercent)}
            </div>
            <div style={{ flex: '0 0 80px', textAlign: 'right', opacity: 0.8 }}>
                {formatVolume(item.quoteVolume)}
            </div>
            <div style={{ flex: 1, textAlign: 'right', paddingRight: '8px' }}>
                <span style={{ fontSize: '9px', opacity: 0.5 }}>[{item.category.substring(0, 3).toUpperCase()}]</span>
            </div>
        </div>
    );
});

export default MarketGrid;
