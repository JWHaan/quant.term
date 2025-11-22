import { get, set, del, keys } from 'idb-keyval';
import type { OHLCV } from '@/types/common';

/**
 * Historical Data Service
 * Fetches and caches historical OHLCV data from Binance
 * Uses IndexedDB for persistent caching
 */

const BINANCE_API_BASE = 'https://api.binance.com/api/v3';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CANDLES_PER_REQUEST = 1000;
const RATE_LIMIT_DELAY = 100; // ms between requests

interface CachedData {
    data: OHLCV[];
    timestamp: number;
    symbol: string;
    interval: string;
}

class HistoricalDataService {
    private lastRequestTime: number = 0;

    /**
     * Fetch historical data with caching
     * @param symbol - Trading pair (e.g., 'BTCUSDT')
     * @param interval - Timeframe (e.g., '15m', '1h', '1d')
     * @param startTime - Start timestamp in milliseconds
     * @param endTime - End timestamp in milliseconds
     * @param forceRefresh - Skip cache and fetch fresh data
     */
    async fetchHistoricalData(
        symbol: string,
        interval: string,
        startTime: number,
        endTime: number,
        forceRefresh: boolean = false
    ): Promise<OHLCV[]> {
        const cacheKey = `hist_${symbol}_${interval}_${startTime}_${endTime}`;

        // Try cache first
        if (!forceRefresh) {
            const cached = await this.getCachedData(cacheKey);
            if (cached) {
                console.log(`[HistoricalData] Cache hit for ${symbol} ${interval}`);
                return cached.data;
            }
        }

        console.log(`[HistoricalData] Fetching ${symbol} ${interval} from ${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`);

        // Fetch from API
        const data = await this.fetchFromAPI(symbol, interval, startTime, endTime);

        // Cache the result
        await this.cacheData(cacheKey, {
            data,
            timestamp: Date.now(),
            symbol,
            interval
        });

        return data;
    }

    /**
     * Fetch data from Binance API with pagination
     */
    private async fetchFromAPI(
        symbol: string,
        interval: string,
        startTime: number,
        endTime: number
    ): Promise<OHLCV[]> {
        const allData: OHLCV[] = [];
        let currentStart = startTime;

        while (currentStart < endTime) {
            // Rate limiting
            await this.rateLimit();

            const url = `${BINANCE_API_BASE}/klines?symbol=${symbol}&interval=${interval}&startTime=${currentStart}&endTime=${endTime}&limit=${MAX_CANDLES_PER_REQUEST}`;

            try {
                const response = await fetch(url);
                
                if (!response.ok) {
                    if (response.status === 429) {
                        console.warn('[HistoricalData] Rate limit hit, waiting 60s');
                        await new Promise(resolve => setTimeout(resolve, 60000));
                        continue;
                    }
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const rawData = await response.json();

                if (!Array.isArray(rawData) || rawData.length === 0) {
                    break;
                }

                const parsed = rawData.map((d: any) => ({
                    time: d[0] / 1000, // Convert to seconds
                    open: parseFloat(d[1]),
                    high: parseFloat(d[2]),
                    low: parseFloat(d[3]),
                    close: parseFloat(d[4]),
                    volume: parseFloat(d[5])
                }));

                allData.push(...parsed);

                // Move to next batch
                const lastCandle = rawData[rawData.length - 1];
                if (!lastCandle) break;
                const lastTime = lastCandle[0];
                if (lastTime >= endTime || rawData.length < MAX_CANDLES_PER_REQUEST) {
                    break;
                }
                currentStart = lastTime + 1;

            } catch (error) {
                console.error('[HistoricalData] Fetch error:', error);
                throw error;
            }
        }

        // Validate data
        this.validateData(allData);

        return allData;
    }

    /**
     * Validate OHLCV data for gaps and invalid values
     */
    private validateData(data: OHLCV[]): void {
        if (data.length === 0) {
            throw new Error('No data returned from API');
        }

        // Check for invalid prices
        const invalidPrices = data.filter(d => 
            d.close <= 0 || !isFinite(d.close) || isNaN(d.close)
        );

        if (invalidPrices.length > 0) {
            console.warn(`[HistoricalData] Found ${invalidPrices.length} candles with invalid prices`);
        }

        // Check for time gaps (basic check)
        for (let i = 1; i < Math.min(data.length, 100); i++) {
            const curr = data[i];
            const prev = data[i - 1];
            if (curr && prev) {
                const timeDiff = curr.time - prev.time;
                if (timeDiff <= 0) {
                    console.warn(`[HistoricalData] Time sequence error at index ${i}`);
                }
            }
        }
    }

    /**
     * Rate limiting helper
     */
    private async rateLimit(): Promise<void> {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;

        if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
            await new Promise(resolve => 
                setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest)
            );
        }

        this.lastRequestTime = Date.now();
    }

    /**
     * Cache data in IndexedDB
     */
    private async cacheData(key: string, data: CachedData): Promise<void> {
        try {
            await set(key, data);
        } catch (error) {
            console.error('[HistoricalData] Cache write error:', error);
        }
    }

    /**
     * Retrieve cached data from IndexedDB
     */
    private async getCachedData(key: string): Promise<CachedData | null> {
        try {
            const cached = await get<CachedData>(key);
            
            if (!cached) {
                return null;
            }

            // Check if cache is expired
            const age = Date.now() - cached.timestamp;
            if (age > CACHE_EXPIRY_MS) {
                await del(key);
                return null;
            }

            return cached;
        } catch (error) {
            console.error('[HistoricalData] Cache read error:', error);
            return null;
        }
    }

    /**
     * Clear old cached data (older than 30 days)
     */
    async clearOldCache(): Promise<void> {
        try {
            const allKeys = await keys();
            const now = Date.now();
            const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

            for (const key of allKeys) {
                if (typeof key === 'string' && key.startsWith('hist_')) {
                    const cached = await get<CachedData>(key);
                    if (cached && (now - cached.timestamp) > thirtyDaysMs) {
                        await del(key);
                        console.log(`[HistoricalData] Deleted old cache: ${key}`);
                    }
                }
            }
        } catch (error) {
            console.error('[HistoricalData] Cache cleanup error:', error);
        }
    }

    /**
     * Clear all cached data
     */
    async clearAllCache(): Promise<void> {
        try {
            const allKeys = await keys();
            for (const key of allKeys) {
                if (typeof key === 'string' && key.startsWith('hist_')) {
                    await del(key);
                }
            }
            console.log('[HistoricalData] Cleared all cache');
        } catch (error) {
            console.error('[HistoricalData] Cache clear error:', error);
        }
    }

    /**
     * Get cache statistics
     */
    async getCacheStats(): Promise<{
        totalEntries: number;
        totalSize: number;
        oldestEntry: number;
        newestEntry: number;
    }> {
        try {
            const allKeys = await keys();
            const histKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith('hist_'));
            
            let totalSize = 0;
            let oldestEntry = Date.now();
            let newestEntry = 0;

            for (const key of histKeys) {
                const cached = await get<CachedData>(key as string);
                if (cached) {
                    totalSize += cached.data.length;
                    oldestEntry = Math.min(oldestEntry, cached.timestamp);
                    newestEntry = Math.max(newestEntry, cached.timestamp);
                }
            }

            return {
                totalEntries: histKeys.length,
                totalSize,
                oldestEntry,
                newestEntry
            };
        } catch (error) {
            console.error('[HistoricalData] Stats error:', error);
            return {
                totalEntries: 0,
                totalSize: 0,
                oldestEntry: 0,
                newestEntry: 0
            };
        }
    }
}

// Export singleton instance
export const historicalDataService = new HistoricalDataService();
export default historicalDataService;
