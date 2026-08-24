import React, { useState, useEffect, useMemo, useCallback, useReducer } from 'react';
import { Search, X } from 'lucide-react';
import { formatPrice, formatVolume, formatPercent, formatBps } from '@/utils/format';
import {
    recordLiveMarketEvent,
    releaseLiveConnection,
    reportLiveConnection,
} from '@/services/marketTelemetry';
import {
    buildWatchlistSeedUrl,
    buildWatchlistStreamUrl,
    extractTickerValues,
    parseTicker,
    type WatchlistMarketData,
} from '@/integrations/binance/watchlist';
import { BINANCE_FUTURES_REST_URL } from '@/constants/config';
import { useMarketStore } from '@/stores/marketStore';

interface MarketGridProps {
    onSelectSymbol?: (symbol: string) => void;
}

export type MarketData = WatchlistMarketData;

const MAJOR_BASES = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'DOGE'] as const;

type MajorBase = (typeof MAJOR_BASES)[number];

export type TickSectionId = 'majors' | 'perps' | 'movers';

type SectionsState = Record<TickSectionId, boolean>;

const DEFAULT_SECTIONS: SectionsState = { majors: true, perps: true, movers: true };

const SECTIONS_STORAGE_KEY = 'qt.tickboard.sections';

const PERPS_POLL_INTERVAL_MS = 60_000;

const PERPS_UNAVAILABLE_MESSAGE = 'Perps data unavailable';

/** One normalized row of the PERPS funding table. */
interface PerpsRow {
    symbol: string;
    base: string;
    markPrice: number;
    fundingBps: number;
    nextFundingTime: number;
}

type PerpsState = { rows: PerpsRow[] | null; error: string | null };

type TickerRecord = Record<string, unknown>;

type PremiumIndexRecord = Record<string, unknown>;

/**
 * Split the visible market data into TICK board sections:
 * majors in canonical order plus top-5 gainers/losers excluding majors.
 */
// Exported as a pure helper for tests; react-refresh would prefer a separate module.
// eslint-disable-next-line react-refresh/only-export-components
export function partitionTickSections(data: MarketData[]): {
    majors: MarketData[];
    moversUp: MarketData[];
    moversDown: MarketData[];
} {
    const byBase = new Map<string, MarketData>();
    for (const item of data) {
        const base = item.symbol.replace(/USDT$|USD$/, '');
        if (!byBase.has(base)) byBase.set(base, item);
    }

    const majors: MarketData[] = [];
    for (const base of MAJOR_BASES) {
        const item = byBase.get(base);
        if (item) majors.push(item);
    }

    const majorSymbols = new Set(majors.map((item) => item.symbol));
    const movers = data.filter((item) => !majorSymbols.has(item.symbol));
    const byChangeDesc = [...movers].sort(
        (a, b) => b.priceChangePercent - a.priceChangePercent,
    );

    return {
        majors,
        moversUp: byChangeDesc.slice(0, 5),
        moversDown: [...byChangeDesc].reverse().slice(0, 5),
    };
}

const readInitialSections = (): SectionsState => {
    if (typeof window === 'undefined') return { ...DEFAULT_SECTIONS };
    try {
        const raw = window.localStorage.getItem(SECTIONS_STORAGE_KEY);
        if (!raw) return { ...DEFAULT_SECTIONS };
        const parsed = JSON.parse(raw) as Partial<SectionsState>;
        return { ...DEFAULT_SECTIONS, ...parsed };
    } catch {
        return { ...DEFAULT_SECTIONS };
    }
};

type SectionsAction = { type: 'toggle'; id: TickSectionId };

function sectionsReducer(state: SectionsState, action: SectionsAction): SectionsState {
    switch (action.type) {
        case 'toggle':
            return { ...state, [action.id]: !state[action.id] };
        default:
            return state;
    }
}

/** Format a remaining-time offset as mm:ss, clamped at 00:00. */
const formatCountdown = (msRemaining: number): string => {
    const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
};

const toPerpsRows = (payload: PremiumIndexRecord[]): PerpsRow[] => {
    const wantedSymbols = new Set<string>(MAJOR_BASES.map((base) => `${base as MajorBase}USDT`));
    return payload
        .filter((record) => typeof record['symbol'] === 'string' && wantedSymbols.has(record['symbol']))
        .map((record) => ({
            symbol: String(record['symbol']),
            base: String(record['symbol']).replace(/USDT$/, ''),
            markPrice: Number(record['markPrice']) || 0,
            fundingBps: (Number(record['lastFundingRate']) || 0) * 10_000,
            nextFundingTime: Number(record['nextFundingTime']) || 0,
        }));
};

/**
 * MarketGrid — Terminal-style live watchlist rendered as a collapsible TICK board.
 * Seeds only the configured markets, then consumes their mini-ticker streams.
 */
const MarketGrid: React.FC<MarketGridProps> = ({ onSelectSymbol }) => {
    const [marketData, setMarketData] = useState<Map<string, MarketData>>(new Map());
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedSections, dispatchSections] = useReducer(
        sectionsReducer,
        undefined,
        readInitialSections,
    );
    const [perpsState, setPerpsState] = useState<PerpsState>({ rows: null, error: null });
    const [now, setNow] = useState(() => Date.now());
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

        const applyTickers = (values: unknown[]): boolean => {
            const parsed = values
                .map(parseTicker)
                .filter((ticker): ticker is NonNullable<ReturnType<typeof parseTicker>> => ticker !== null);
            if (disposed || parsed.length === 0) return false;

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
            return true;
        };

        const fetchInitialTickers = async () => {
            try {
                const response = await fetch(buildWatchlistSeedUrl(), {
                    signal: controller.signal,
                });
                if (!response.ok) throw new Error(`Watchlist seed failed (${response.status})`);
                const data: unknown = await response.json();
                if (!Array.isArray(data)) throw new Error('Unexpected watchlist response');
                if (!applyTickers(data)) throw new Error('No current watchlist markets returned');
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
            ws = new WebSocket(buildWatchlistStreamUrl());
            const currentSocket = ws;

            currentSocket.onopen = () => {
                if (disposed || ws !== currentSocket) return;
                lastMessageAt = Date.now();
            };
            currentSocket.onmessage = (event: MessageEvent<string>) => {
                if (disposed || ws !== currentSocket) return;
                try {
                    const payload: unknown = JSON.parse(event.data);
                    const data = extractTickerValues(payload);
                    if (!applyTickers(data)) return;
                    lastMessageAt = Date.now();
                    reconnectAttempts = 0;
                    reportLiveConnection('marketData', connectionOwner, 'connected');
                    setError(null);
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

    // Bulk premiumIndex polling — on mount and every 60s while PERPS is expanded.
    useEffect(() => {
        if (!expandedSections.perps) return undefined;
        let disposed = false;
        const controller = new AbortController();

        const pollPremiumIndex = async () => {
            try {
                const response = await fetch(`${BINANCE_FUTURES_REST_URL}/fapi/v1/premiumIndex`, {
                    signal: controller.signal,
                });
                if (!response.ok) throw new Error(`Funding poll failed (${response.status})`);
                const payload: unknown = await response.json();
                if (!Array.isArray(payload)) throw new Error('Unexpected premiumIndex response');
                if (!disposed) setPerpsState({ rows: toPerpsRows(payload), error: null });
            } catch (caught: unknown) {
                if (disposed || controller.signal.aborted) return;
                console.error('[Binance futures] Funding poll failed:', caught);
                setPerpsState({ rows: null, error: PERPS_UNAVAILABLE_MESSAGE });
            }
        };

        pollPremiumIndex();
        const pollTimer = setInterval(pollPremiumIndex, PERPS_POLL_INTERVAL_MS);

        return () => {
            disposed = true;
            controller.abort();
            clearInterval(pollTimer);
        };
    }, [expandedSections.perps]);

    // Countdown ticker — recomputes once a second while PERPS is expanded.
    useEffect(() => {
        if (!expandedSections.perps) return undefined;
        const ticker = setInterval(() => setNow(Date.now()), 1_000);
        return () => clearInterval(ticker);
    }, [expandedSections.perps]);

    const handleToggleSection = useCallback((id: TickSectionId) => {
        dispatchSections({ type: 'toggle', id });
    }, []);

    useEffect(() => {
        try {
            window.localStorage.setItem(SECTIONS_STORAGE_KEY, JSON.stringify(expandedSections));
        } catch {
            // Section persistence is an optional browser convenience.
        }
    }, [expandedSections]);

    const visibleData = useMemo(() => {
        let data = Array.from(marketData.values());

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            data = data.filter(item =>
                item.name.toLowerCase().includes(q) ||
                item.symbol.toLowerCase().includes(q)
            );
        }

        return data;
    }, [marketData, searchQuery]);

    const sections = useMemo(
        () => partitionTickSections(visibleData),
        [visibleData],
    );

    const handleSelectSymbol = useCallback((symbol: string) => {
        if (onSelectSymbol) {
            onSelectSymbol(symbol);
            return;
        }
        setSelectedSymbol(symbol);
    }, [onSelectSymbol, setSelectedSymbol]);

    const renderQuoteTable = (
        ariaLabel: string,
        rows: MarketData[],
    ): React.ReactElement => (
        <table className="market-grid__table" aria-label={ariaLabel}>
            <colgroup>
                <col className="market-grid__col-symbol" />
                <col className="market-grid__col-price" />
                <col className="market-grid__col-change" />
                <col className="market-grid__col-volume" />
            </colgroup>
            <thead>
                <tr>
                    <th scope="col">Symbol</th>
                    <th scope="col">Last</th>
                    <th scope="col">24H</th>
                    <th scope="col">Vol</th>
                </tr>
            </thead>
            <tbody>
                {rows.map((item) => (
                    <MarketRow
                        key={item.symbol}
                        item={item}
                        isSelected={selectedSymbol === item.symbol}
                        onSelect={handleSelectSymbol}
                    />
                ))}
            </tbody>
        </table>
    );

    const moversBody = (
        <>
            <div className="tickboard__group">
                <span className="tickboard__group-label">TOP ↑</span>
                {renderQuoteTable('Top gaining assets', sections.moversUp)}
            </div>
            <div className="tickboard__group">
                <span className="tickboard__group-label">TOP ↓</span>
                {renderQuoteTable('Top losing assets', sections.moversDown)}
            </div>
        </>
    );

    const perpsBody = (() => {
        if (perpsState.error && !perpsState.rows?.length) {
            return (
                <p className="tickboard__muted" role="status" aria-live="polite">
                    {PERPS_UNAVAILABLE_MESSAGE}
                </p>
            );
        }
        if (!perpsState.rows?.length) {
            return (
                <p className="tickboard__muted" role="status" aria-live="polite">
                    Loading funding rates
                </p>
            );
        }
        return (
            <table className="market-grid__table" aria-label="Major perpetual funding">
                <colgroup>
                    <col className="market-grid__col-symbol" />
                    <col className="market-grid__col-price" />
                    <col className="market-grid__col-change" />
                    <col className="market-grid__col-volume" />
                </colgroup>
                <thead>
                    <tr>
                        <th scope="col">Symbol</th>
                        <th scope="col">Mark</th>
                        <th scope="col">Funding</th>
                        <th scope="col">Next</th>
                    </tr>
                </thead>
                <tbody>
                    {perpsState.rows.map((row) => (
                        <tr
                            key={row.symbol}
                            className="market-grid__row"
                            aria-label={`${row.base} perpetual funding ${formatBps(row.fundingBps)}`}
                        >
                            <td className="market-grid__symbol">{row.base}</td>
                            <td className="market-grid__price">{formatPrice(row.markPrice)}</td>
                            <td className={row.fundingBps >= 0 ? 'market-grid__change positive' : 'market-grid__change negative'}>{formatBps(row.fundingBps)}</td>
                            <td className="market-grid__volume">{formatCountdown(row.nextFundingTime - now)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    })();

    return (
        <div className="tickboard">
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
                    aria-label={`${visibleData.length} assets shown`}
                >
                    {visibleData.length}
                </output>
            </div>

            {error && (
                <div className="market-grid__feed-status" role="status" aria-live="polite">
                    <span aria-hidden="true" />
                    {error}
                </div>
            )}

            <div className="tickboard__scroller">
                <TickSection
                    id="majors"
                    title="MAJORS"
                    expanded={expandedSections.majors}
                    onToggle={handleToggleSection}
                >
                    {renderQuoteTable('Major asset watchlist', sections.majors)}
                </TickSection>
                <TickSection
                    id="perps"
                    title="PERPS"
                    expanded={expandedSections.perps}
                    onToggle={handleToggleSection}
                >
                    {perpsBody}
                </TickSection>
                <TickSection
                    id="movers"
                    title="MOVERS"
                    expanded={expandedSections.movers}
                    onToggle={handleToggleSection}
                >
                    {moversBody}
                </TickSection>

                {loading && visibleData.length === 0 && (
                    <div className="market-grid__empty" role="status" aria-live="polite">
                        <span className="market-grid__loader" aria-hidden="true" />
                        Loading live markets
                    </div>
                )}

                {!loading && visibleData.length === 0 && (
                    <div className="market-grid__empty">
                        No assets match “{searchQuery}”
                    </div>
                )}
            </div>
        </div>
    );
};

interface TickSectionProps {
    id: TickSectionId;
    title: string;
    expanded: boolean;
    onToggle: (id: TickSectionId) => void;
    children: React.ReactNode;
}

const TickSection = ({ id, title, expanded, onToggle, children }: TickSectionProps) => (
    <section className="tickboard__section" data-testid={`tick-section-${id}`}>
        <button
            type="button"
            className="tickboard__section-header"
            aria-expanded={expanded}
            aria-controls={`tickboard-body-${id}`}
            onClick={() => onToggle(id)}
        >
            <span className={`tickboard__chevron${expanded ? '' : ' tickboard__chevron--collapsed'}`} aria-hidden="true">▾</span>
            <span className="tickboard__title">{title}</span>
        </button>
        {expanded && (
            <div id={`tickboard-body-${id}`} className="tickboard__section-body">
                {children}
            </div>
        )}
    </section>
);

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
