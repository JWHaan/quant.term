import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { TOP_CRYPTOS } from '@/data/cryptoAssets';
import { formatPrice, formatVolume, formatPercent } from '@/utils/format';
import { BINANCE_REST_URL, BINANCE_WS_URL } from '@/constants/config';
import {
    recordLiveMarketEvent,
    releaseLiveConnection,
    reportLiveConnection,
} from '@/services/liveMarketData';
import { useMarketStore } from '@/stores/marketStore';
import type { MarketData as StoreMarketData } from '@/types/binance';

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

type TickerRecord = Record<string, unknown>;

const ASSET_META = new Map(TOP_CRYPTOS.map((asset) => [asset.symbol, asset]));

const readNumber = (ticker: TickerRecord, longKey: string, shortKey: string): number => {
    const value = ticker[longKey] ?? ticker[shortKey];
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const parseTicker = (value: unknown): { display: MarketData; store: StoreMarketData } | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const ticker = value as TickerRecord;
    const rawSymbol = ticker['symbol'] ?? ticker['s'];
    if (typeof rawSymbol !== 'string') return null;

    const symbol = rawSymbol.toUpperCase();
    const meta = ASSET_META.get(symbol);
    if (!meta) return null;

    const price = readNumber(ticker, 'lastPrice', 'c');
    const priceChange = readNumber(ticker, 'priceChange', 'p');
    let priceChangePercent = readNumber(ticker, 'priceChangePercent', 'P');
    const open = readNumber(ticker, 'openPrice', 'o');
    if (!priceChangePercent && open > 0 && price > 0) {
        priceChangePercent = ((price - open) / open) * 100;
    }
    const quoteVolume = readNumber(ticker, 'quoteVolume', 'q');
    if (price <= 0) return null;

    return {
        display: {
            symbol,
            name: meta.name,
            category: meta.category,
            price,
            priceChangePercent,
            quoteVolume,
        },
        store: {
            symbol,
            price,
            priceChange,
            priceChangePercent,
            volume: readNumber(ticker, 'volume', 'v'),
            quoteVolume,
            high: readNumber(ticker, 'highPrice', 'h'),
            low: readNumber(ticker, 'lowPrice', 'l'),
            timestamp: Date.now(),
        },
    };
};

const renderSortIndicator = (sortBy: SortKey, sortDir: 'asc' | 'desc', column: SortKey) =>
    sortBy === column
        ? <span className="market-grid__sort-indicator" aria-hidden="true">{sortDir === 'asc' ? '↑' : '↓'}</span>
        : null;

const getAriaSort = (
    sortBy: SortKey,
    sortDir: 'asc' | 'desc',
    column: SortKey,
): 'ascending' | 'descending' | 'none' => {
    if (sortBy !== column) return 'none';
    return sortDir === 'asc' ? 'ascending' : 'descending';
};

/**
 * MarketGrid — Terminal-style live watchlist.
 * Seeds from one all-market REST request, then consumes one all-market stream.
 */
const MarketGrid: React.FC<MarketGridProps> = ({ onSelectSymbol }) => {
    const [marketData, setMarketData] = useState<Map<string, MarketData>>(new Map());
    const [sortBy, setSortBy] = useState<SortKey>('quoteVolume');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const connectionOwnerRef = React.useRef<object>({});
    const selectedSymbol = useMarketStore((state) => state.selectedSymbol);
    const setSelectedSymbol = useMarketStore((state) => state.setSymbol);

    useEffect(() => {
        let disposed = false;
        let reconnectAttempts = 0;
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
        let ws: WebSocket | null = null;
        let lastMessageAt = 0;
        let seedTimedOut = false;
        const controller = new AbortController();
        const connectionOwner = connectionOwnerRef.current;
        const seedTimeout = setTimeout(() => {
            seedTimedOut = true;
            controller.abort();
        }, 8_000);

        const applyTickers = (values: unknown[]) => {
            const parsed = values
                .map(parseTicker)
                .filter((ticker): ticker is NonNullable<ReturnType<typeof parseTicker>> => ticker !== null);
            if (disposed || parsed.length === 0) return;

            setMarketData((previous) => {
                const next = new Map(previous);
                parsed.forEach(({ display }) => next.set(display.symbol, display));
                return next;
            });

            const storeUpdates = Object.fromEntries(parsed.map(({ store }) => [store.symbol, store]));
            useMarketStore.setState((state) => ({
                marketData: { ...state.marketData, ...storeUpdates },
                lastUpdate: Date.now(),
            }));
            setLoading(false);
            setError(null);
        };

        const fetchInitialTickers = async () => {
            try {
                const response = await fetch(`${BINANCE_REST_URL}/api/v3/ticker/24hr`, {
                    signal: controller.signal,
                });
                if (!response.ok) throw new Error(`Watchlist seed failed (${response.status})`);
                const data: unknown = await response.json();
                if (!Array.isArray(data)) throw new Error('Unexpected watchlist response');
                applyTickers(data);
            } catch (caught: unknown) {
                if (disposed || (controller.signal.aborted && !seedTimedOut)) return;
                setLoading(false);
                setError(seedTimedOut
                    ? 'Watchlist seed timed out; waiting for live feed'
                    : caught instanceof Error
                        ? caught.message
                        : 'Failed to seed watchlist');
            } finally {
                clearTimeout(seedTimeout);
            }
        };

        const scheduleReconnect = (connect: () => void) => {
            if (disposed || reconnectTimer) return;
            const delay = Math.min(30_000, 1_000 * (2 ** reconnectAttempts));
            reconnectAttempts += 1;
            reportLiveConnection('marketData', connectionOwner, 'reconnecting');
            setError('Live watchlist feed reconnecting');
            reconnectTimer = setTimeout(() => {
                reconnectTimer = null;
                connect();
            }, delay);
        };

        const connect = () => {
            if (disposed) return;
            reportLiveConnection(
                'marketData',
                connectionOwner,
                reconnectAttempts > 0 ? 'reconnecting' : 'connecting',
            );
            ws = new WebSocket(`${BINANCE_WS_URL}/ws/!ticker@arr`);
            const currentSocket = ws;

            currentSocket.onopen = () => {
                if (disposed || ws !== currentSocket) return;
                reconnectAttempts = 0;
                lastMessageAt = Date.now();
                reportLiveConnection('marketData', connectionOwner, 'connected');
                setError(null);
            };
            currentSocket.onmessage = (event: MessageEvent<string>) => {
                if (disposed || ws !== currentSocket) return;
                try {
                    const data: unknown = JSON.parse(event.data);
                    if (!Array.isArray(data)) return;
                    lastMessageAt = Date.now();
                    applyTickers(data);
                    const firstEvent = data.find((item) => item && typeof item === 'object') as TickerRecord | undefined;
                    const timestamp = firstEvent ? Number(firstEvent['E']) : Number.NaN;
                    recordLiveMarketEvent(
                        'binance',
                        Number.isFinite(timestamp) ? timestamp : undefined,
                    );
                } catch (caught) {
                    console.error('[Binance watchlist] Failed to parse ticker stream:', caught);
                }
            };
            currentSocket.onerror = () => {
                if (disposed || ws !== currentSocket) return;
                reportLiveConnection('marketData', connectionOwner, 'error');
                currentSocket.close();
            };
            currentSocket.onclose = () => {
                if (disposed || ws !== currentSocket) return;
                scheduleReconnect(connect);
            };
        };

        fetchInitialTickers();
        connect();

        const watchdog = setInterval(() => {
            if (
                !disposed &&
                ws?.readyState === WebSocket.OPEN &&
                lastMessageAt > 0 &&
                Date.now() - lastMessageAt > 10_000
            ) {
                setError('Live watchlist feed stalled; reconnecting');
                ws.close();
            }
        }, 1_000);

        return () => {
            disposed = true;
            controller.abort();
            clearTimeout(seedTimeout);
            clearInterval(watchdog);
            if (reconnectTimer) clearTimeout(reconnectTimer);
            if (ws) {
                ws.onopen = null;
                ws.onmessage = null;
                ws.onerror = null;
                ws.onclose = null;
                if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close();
            }
            releaseLiveConnection('marketData', connectionOwner);
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

    const handleSelectSymbol = useCallback((symbol: string) => {
        if (onSelectSymbol) {
            onSelectSymbol(symbol);
            return;
        }
        setSelectedSymbol(symbol);
    }, [onSelectSymbol, setSelectedSymbol]);

    return (
        <div className="market-grid">
            <div className="market-grid__toolbar">
                <div className="market-grid__search">
                    <Search size={13} aria-hidden="true" />
                    <label className="visually-hidden" htmlFor="market-watch-search">Filter market watchlist</label>
                    <input
                        id="market-watch-search"
                        type="search"
                        placeholder="Filter assets"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        autoComplete="off"
                        spellCheck={false}
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            className="market-grid__clear"
                            onClick={() => setSearchQuery('')}
                            aria-label="Clear asset filter"
                        >
                            <X size={12} aria-hidden="true" />
                        </button>
                    )}
                </div>
                <output
                    id="market-watch-count"
                    className="market-grid__count"
                    aria-label={`${sortedData.length} assets shown`}
                >
                    {sortedData.length}
                </output>
            </div>

            {error && (
                <div className="market-grid__feed-status" role="status" aria-live="polite">
                    <span aria-hidden="true" />
                    {error}
                </div>
            )}

            <div className="market-grid__scroller">
                <table className="market-grid__table" aria-label="Live cryptocurrency watchlist" aria-describedby="market-watch-count">
                    <colgroup>
                        <col className="market-grid__col-symbol" />
                        <col className="market-grid__col-price" />
                        <col className="market-grid__col-change" />
                        <col className="market-grid__col-volume" />
                    </colgroup>
                    <thead>
                        <tr>
                            <th scope="col" aria-sort={getAriaSort(sortBy, sortDir, 'symbol')}>
                                <button type="button" onClick={() => handleSort('symbol')}>
                                    Symbol{renderSortIndicator(sortBy, sortDir, 'symbol')}
                                </button>
                            </th>
                            <th scope="col" aria-sort={getAriaSort(sortBy, sortDir, 'price')}>
                                <button type="button" onClick={() => handleSort('price')}>
                                    Price{renderSortIndicator(sortBy, sortDir, 'price')}
                                </button>
                            </th>
                            <th scope="col" aria-sort={getAriaSort(sortBy, sortDir, 'priceChangePercent')}>
                                <button type="button" onClick={() => handleSort('priceChangePercent')}>
                                    24H{renderSortIndicator(sortBy, sortDir, 'priceChangePercent')}
                                </button>
                            </th>
                            <th scope="col" aria-sort={getAriaSort(sortBy, sortDir, 'quoteVolume')}>
                                <button type="button" onClick={() => handleSort('quoteVolume')}>
                                    Vol{renderSortIndicator(sortBy, sortDir, 'quoteVolume')}
                                </button>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedData.map((item) => (
                            <MarketRow
                                key={item.symbol}
                                item={item}
                                isSelected={selectedSymbol === item.symbol}
                                onSelect={handleSelectSymbol}
                            />
                        ))}
                    </tbody>
                </table>

                {loading && sortedData.length === 0 && (
                    <div className="market-grid__empty" role="status" aria-live="polite">
                        <span className="market-grid__loader" aria-hidden="true" />
                        Loading live markets
                    </div>
                )}

                {!loading && sortedData.length === 0 && (
                    <div className="market-grid__empty">
                        No assets match “{searchQuery}”
                    </div>
                )}
            </div>
        </div>
    );
};

interface MarketRowProps {
    item: MarketData;
    isSelected: boolean;
    onSelect: (symbol: string) => void;
}

const MarketRow = React.memo(({ item, isSelected, onSelect }: MarketRowProps) => {
    const isPositive = (item.priceChangePercent ?? 0) >= 0;
    const baseSymbol = item.symbol.replace(/USDT$|USD$/, '');

    const selectRow = () => onSelect(item.symbol);

    return (
        <tr
            className="market-grid__row"
            data-selected={isSelected}
            aria-selected={isSelected}
            tabIndex={0}
            onClick={selectRow}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    selectRow();
                }
            }}
            aria-label={`${item.name}, ${baseSymbol}, price ${formatPrice(item.price)}, 24 hour change ${formatPercent(item.priceChangePercent)}, volume ${formatVolume(item.quoteVolume)}`}
            title={`${item.name} · ${item.category}`}
        >
            <td className="market-grid__symbol">{baseSymbol}</td>
            <td className="market-grid__price">{formatPrice(item.price)}</td>
            <td className={isPositive ? 'market-grid__change market-grid__change--positive' : 'market-grid__change market-grid__change--negative'}>
                {formatPercent(item.priceChangePercent)}
            </td>
            <td className="market-grid__volume">${formatVolume(item.quoteVolume, 1)}</td>
        </tr>
    );
});

export default MarketGrid;
