import { describe, expect, it } from 'vitest';
import {
    BINANCE_FUTURES_SYMBOL_ALIASES,
    BINANCE_SPOT_SYMBOL_ALIASES,
    normalizeBinanceSpotSymbol,
    toBinanceFuturesSymbol,
} from '@/constants/config';
import { CRYPTO_CATEGORIES, TOP_CRYPTOS } from '@/data/cryptoAssets';
import {
    buildWatchlistSeedUrl,
    buildWatchlistStreamUrl,
    extractTickerValues,
    parseTicker,
} from '@/services/binanceWatchlist';
import { useMarketStore } from '@/stores/marketStore';

const RETIRED_SPOT_SYMBOLS = ['MATICUSDT', 'RNDRUSDT', 'MKRUSDT', 'FTMUSDT'] as const;
const CURRENT_SPOT_SYMBOLS = ['POLUSDT', 'RENDERUSDT', 'SKYUSDT', 'SUSDT'] as const;

describe('Binance watchlist data pipeline', () => {
    it('extracts and parses a combined mini-ticker update using provider time', () => {
        const providerTimestamp = 1_784_341_857_016;
        const payload = {
            stream: 'btcusdt@miniTicker',
            data: {
                e: '24hrMiniTicker',
                E: providerTimestamp,
                s: 'BTCUSDT',
                c: '64010.25',
                o: '63000.00',
                h: '64500.00',
                l: '62500.00',
                v: '17184.41592',
                q: '1088605297.52483640',
            },
        };

        const values = extractTickerValues(payload);
        expect(values).toHaveLength(1);

        const parsed = parseTicker(values[0]);
        expect(parsed?.display).toMatchObject({
            symbol: 'BTCUSDT',
            name: 'Bitcoin',
            price: 64_010.25,
            quoteVolume: 1_088_605_297.5248364,
        });
        expect(parsed?.store).toMatchObject({
            symbol: 'BTCUSDT',
            price: 64_010.25,
            priceChange: 1_010.25,
            high: 64_500,
            low: 62_500,
            timestamp: providerTimestamp,
        });
        expect(parsed?.store.priceChangePercent).toBeCloseTo((1_010.25 / 63_000) * 100, 10);
    });

    it('derives change fields from a MINI REST ticker and preserves closeTime', () => {
        const providerTimestamp = 1_784_341_900_000;
        const parsed = parseTicker({
            symbol: 'ETHUSDT',
            openPrice: '1800.00',
            highPrice: '1900.00',
            lowPrice: '1790.00',
            lastPrice: '1844.25',
            volume: '228000',
            quoteVolume: '421930924.47987200',
            closeTime: providerTimestamp,
        });

        expect(parsed?.store.priceChange).toBe(44.25);
        expect(parsed?.store.priceChangePercent).toBeCloseTo((44.25 / 1_800) * 100, 10);
        expect(parsed?.store.timestamp).toBe(providerTimestamp);
    });

    it('builds a targeted MINI REST seed URL', () => {
        const url = new URL(buildWatchlistSeedUrl(['BTCUSDT', 'ETHUSDT']));

        expect(url.origin).toBe('https://data-api.binance.vision');
        expect(url.pathname).toBe('/api/v3/ticker/24hr');
        expect(url.searchParams.get('type')).toBe('MINI');
        expect(JSON.parse(url.searchParams.get('symbols') ?? '[]')).toEqual(['BTCUSDT', 'ETHUSDT']);
    });

    it('builds one combined mini-ticker stream for only requested symbols', () => {
        const url = new URL(buildWatchlistStreamUrl(['BTCUSDT', 'ETHUSDT']));

        expect(url.origin).toBe('wss://data-stream.binance.vision');
        expect(url.pathname).toBe('/stream');
        expect(url.searchParams.get('streams')).toBe('btcusdt@miniTicker/ethusdt@miniTicker');
        expect(url.href).not.toContain('!ticker@arr');
    });

    it('targets the complete current catalog by default', () => {
        const expectedSymbols = TOP_CRYPTOS.map((asset) => asset.symbol);
        const seedUrl = new URL(buildWatchlistSeedUrl());
        const streamUrl = new URL(buildWatchlistStreamUrl());

        expect(JSON.parse(seedUrl.searchParams.get('symbols') ?? '[]')).toEqual(expectedSymbols);
        expect(streamUrl.searchParams.get('streams')?.split('/')).toEqual(
            expectedSymbols.map((symbol) => `${symbol.toLowerCase()}@miniTicker`),
        );
    });
});

describe('current Binance symbols and persisted preference migration', () => {
    it('maps every retired spot symbol to its active successor', () => {
        expect(BINANCE_SPOT_SYMBOL_ALIASES).toEqual({
            MATICUSDT: 'POLUSDT',
            RNDRUSDT: 'RENDERUSDT',
            MKRUSDT: 'SKYUSDT',
            FTMUSDT: 'SUSDT',
        });
        expect(RETIRED_SPOT_SYMBOLS.map(normalizeBinanceSpotSymbol)).toEqual(CURRENT_SPOT_SYMBOLS);
        expect(normalizeBinanceSpotSymbol('btcusdt')).toBe('BTCUSDT');
    });

    it('normalizes the futures-only SHIB contract alias after spot migration', () => {
        expect(BINANCE_FUTURES_SYMBOL_ALIASES).toEqual({ SHIBUSDT: '1000SHIBUSDT' });
        expect(toBinanceFuturesSymbol('shibusdt')).toBe('1000SHIBUSDT');
        expect(toBinanceFuturesSymbol('maticusdt')).toBe('POLUSDT');
    });

    it('migrates and deduplicates retired symbols from persisted market state', () => {
        const merge = useMarketStore.persist.getOptions().merge;
        expect(merge).toBeTypeOf('function');
        if (!merge) throw new Error('marketStore persistence merge is not configured');

        const migrated = merge(
            {
                selectedSymbol: 'maticusdt',
                watchlist: [
                    'BTCUSDT',
                    'MATICUSDT',
                    'POLUSDT',
                    'RNDRUSDT',
                    'FTMUSDT',
                    'MKRUSDT',
                ],
            },
            useMarketStore.getInitialState(),
        );

        expect(migrated.selectedSymbol).toBe('POLUSDT');
        expect(migrated.watchlist).toEqual([
            'BTCUSDT',
            'POLUSDT',
            'RENDERUSDT',
            'SUSDT',
            'SKYUSDT',
        ]);
    });

    it('contains 40 unique current markets and no retired category references', () => {
        const catalogSymbols = TOP_CRYPTOS.map((asset) => asset.symbol);
        const categorySymbols = Object.values(CRYPTO_CATEGORIES).flat();

        expect(catalogSymbols).toHaveLength(40);
        expect(new Set(catalogSymbols).size).toBe(40);
        expect(catalogSymbols).toEqual(expect.arrayContaining([...CURRENT_SPOT_SYMBOLS]));
        expect(new Set(categorySymbols)).toEqual(new Set(catalogSymbols));
        RETIRED_SPOT_SYMBOLS.forEach((symbol) => {
            expect(catalogSymbols).not.toContain(symbol);
            expect(categorySymbols).not.toContain(symbol);
        });
    });
});
