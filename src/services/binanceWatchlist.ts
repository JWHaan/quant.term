import { BINANCE_REST_URL, BINANCE_WS_URL } from '@/constants/config';
import { TOP_CRYPTOS } from '@/data/cryptoAssets';
import type { MarketData as StoreMarketData } from '@/types/binance';

export interface WatchlistMarketData {
    symbol: string;
    name: string;
    category: string;
    price: number;
    priceChangePercent: number;
    quoteVolume: number;
}

type TickerRecord = Record<string, unknown>;

const ASSET_META = new Map(TOP_CRYPTOS.map((asset) => [asset.symbol, asset]));
const WATCHLIST_SYMBOLS = TOP_CRYPTOS.map((asset) => asset.symbol);

export const buildWatchlistSeedUrl = (symbols: string[] = WATCHLIST_SYMBOLS): string =>
    `${BINANCE_REST_URL}/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}&type=MINI`;

export const buildWatchlistStreamUrl = (symbols: string[] = WATCHLIST_SYMBOLS): string => {
    const streams = symbols.map((symbol) => `${symbol.toLowerCase()}@miniTicker`).join('/');
    return `${BINANCE_WS_URL}/stream?streams=${streams}`;
};

const readNumber = (ticker: TickerRecord, longKey: string, shortKey: string): number => {
    const value = ticker[longKey] ?? ticker[shortKey];
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

export const parseTicker = (value: unknown): { display: WatchlistMarketData; store: StoreMarketData } | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const ticker = value as TickerRecord;
    const rawSymbol = ticker['symbol'] ?? ticker['s'];
    if (typeof rawSymbol !== 'string') return null;

    const symbol = rawSymbol.toUpperCase();
    const meta = ASSET_META.get(symbol);
    if (!meta) return null;

    const price = readNumber(ticker, 'lastPrice', 'c');
    let priceChange = readNumber(ticker, 'priceChange', 'p');
    let priceChangePercent = readNumber(ticker, 'priceChangePercent', 'P');
    const open = readNumber(ticker, 'openPrice', 'o');
    if (!priceChange && open > 0 && price > 0) priceChange = price - open;
    if (!priceChangePercent && open > 0 && price > 0) {
        priceChangePercent = ((price - open) / open) * 100;
    }
    const quoteVolume = readNumber(ticker, 'quoteVolume', 'q');
    if (price <= 0) return null;

    const providerTimestamp = Number(
        ticker['eventTime'] ?? ticker['E'] ?? ticker['closeTime'] ?? ticker['C'],
    );
    const timestamp = Number.isFinite(providerTimestamp) && providerTimestamp > 1_000_000_000_000
        ? providerTimestamp
        : 0;

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
            timestamp,
        },
    };
};

export const extractTickerValues = (payload: unknown): unknown[] => {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];
    const data = (payload as TickerRecord)['data'];
    return data && typeof data === 'object' && !Array.isArray(data) ? [data] : [];
};
