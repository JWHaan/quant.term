/**
 * Tick Rule & Lee-Ready Trade Classification
 * 
 * Classifies trades as buyer-initiated or seller-initiated using price movement rules.
 * This enables accurate Volume Delta (CVD) calculation.
 * 
 * References:
 * - Lee, C. M., & Ready, M. J. (1991). Inferring trade direction from intraday data
 * - Chakrabarty, B., Li, B., Nguyen, V., & Van Ness, R. A. (2007). Trade classification algorithms
 */

export interface Trade {
    id: number;
    price: number;
    quantity: number;
    timestamp: number;
    isBuyerMaker: boolean; // From exchange (if available)
}

export interface ClassifiedTrade extends Trade {
    side: 'buy' | 'sell';
    classificationMethod: 'tick' | 'quote' | 'exchange';
}

export interface VolumeDelta {
    buyVolume: number;
    sellVolume: number;
    delta: number;
    deltaPercent: number;
    timestamp: number;
}

export class TradeClassifier {
    private previousPrice: number | null = null;
    private previousMidPrice: number | null = null;
    private classifiedTrades: ClassifiedTrade[] = [];
    private readonly maxHistorySize = 10000;

    /**
     * Classify a trade using Tick Rule
     * If price > previous price → buy
     * If price < previous price → sell
     * If price = previous price → use previous classification (zero-tick rule)
     */
    classifyByTickRule(trade: Trade): ClassifiedTrade {
        let side: 'buy' | 'sell';

        if (this.previousPrice === null) {
            // First trade: use exchange data if available
            side = trade.isBuyerMaker ? 'sell' : 'buy';
        } else if (trade.price > this.previousPrice) {
            // Uptick → buyer-initiated
            side = 'buy';
        } else if (trade.price < this.previousPrice) {
            // Downtick → seller-initiated
            side = 'sell';
        } else {
            // Zero-tick: use previous classification or exchange data
            const lastClassified = this.classifiedTrades[this.classifiedTrades.length - 1];
            side = lastClassified?.side || (trade.isBuyerMaker ? 'sell' : 'buy');
        }

        this.previousPrice = trade.price;

        const classified: ClassifiedTrade = {
            ...trade,
            side,
            classificationMethod: 'tick'
        };

        this.addToHistory(classified);
        return classified;
    }

    /**
     * Classify using Lee-Ready algorithm (requires order book mid-price)
     * If trade price > mid-price → buy
     * If trade price < mid-price → sell
     * If trade price = mid-price → use tick rule
     */
    classifyByLeeReady(trade: Trade, currentMidPrice: number): ClassifiedTrade {
        let side: 'buy' | 'sell';

        if (trade.price > currentMidPrice) {
            // Above mid → buyer-initiated (aggressive buy)
            side = 'buy';
        } else if (trade.price < currentMidPrice) {
            // Below mid → seller-initiated (aggressive sell)
            side = 'sell';
        } else {
            // At mid-price: fall back to tick rule
            if (this.previousMidPrice !== null) {
                if (trade.price > this.previousMidPrice) {
                    side = 'buy';
                } else if (trade.price < this.previousMidPrice) {
                    side = 'sell';
                } else {
                    // Use exchange data as last resort
                    side = trade.isBuyerMaker ? 'sell' : 'buy';
                }
            } else {
                side = trade.isBuyerMaker ? 'sell' : 'buy';
            }
        }

        this.previousMidPrice = currentMidPrice;
        this.previousPrice = trade.price;

        const classified: ClassifiedTrade = {
            ...trade,
            side,
            classificationMethod: 'quote'
        };

        this.addToHistory(classified);
        return classified;
    }

    /**
     * Calculate Volume Delta for a time window
     */
    calculateVolumeDelta(windowMs: number = 60000): VolumeDelta {
        const now = Date.now();
        const cutoff = now - windowMs;

        const recentTrades = this.classifiedTrades.filter(t => t.timestamp >= cutoff);

        let buyVolume = 0;
        let sellVolume = 0;

        recentTrades.forEach(trade => {
            if (trade.side === 'buy') {
                buyVolume += trade.quantity;
            } else {
                sellVolume += trade.quantity;
            }
        });

        const totalVolume = buyVolume + sellVolume;
        const delta = buyVolume - sellVolume;
        const deltaPercent = totalVolume > 0 ? (delta / totalVolume) * 100 : 0;

        return {
            buyVolume,
            sellVolume,
            delta,
            deltaPercent,
            timestamp: now
        };
    }

    /**
     * Get cumulative volume delta (CVD) over time
     */
    getCumulativeVolumeDelta(intervalMs: number = 60000): Array<{ timestamp: number; cvd: number }> {
        const result: Array<{ timestamp: number; cvd: number }> = [];

        if (this.classifiedTrades.length === 0) return result;

        const firstTrade = this.classifiedTrades[0];
        if (!firstTrade) return result;

        const startTime = firstTrade.timestamp;

        let cvd = 0;
        let currentBucket = Math.floor(startTime / intervalMs) * intervalMs;

        this.classifiedTrades.forEach(trade => {
            const tradeBucket = Math.floor(trade.timestamp / intervalMs) * intervalMs;

            // New bucket
            if (tradeBucket > currentBucket) {
                result.push({ timestamp: currentBucket, cvd });
                currentBucket = tradeBucket;
            }

            // Update CVD
            if (trade.side === 'buy') {
                cvd += trade.quantity;
            } else {
                cvd -= trade.quantity;
            }
        });

        // Add final bucket
        result.push({ timestamp: currentBucket, cvd });

        return result;
    }

    /**
     * Detect divergence between price and CVD
     * Bullish divergence: price down, CVD up
     * Bearish divergence: price up, CVD down
     */
    detectDivergence(priceData: Array<{ timestamp: number; price: number }>): {
        type: 'bullish' | 'bearish' | null;
        strength: number;
    } {
        const cvdData = this.getCumulativeVolumeDelta(60000);

        if (cvdData.length < 2 || priceData.length < 2) {
            return { type: null, strength: 0 };
        }

        // Compare last 10 data points
        const lookback = Math.min(10, cvdData.length, priceData.length);

        const recentCVD = cvdData.slice(-lookback);
        const recentPrice = priceData.slice(-lookback);

        if (recentCVD.length < 2 || recentPrice.length < 2) {
            return { type: null, strength: 0 };
        }

        const lastCVD = recentCVD[recentCVD.length - 1];
        const firstCVD = recentCVD[0];
        const lastPrice = recentPrice[recentPrice.length - 1];
        const firstPrice = recentPrice[0];

        if (!lastCVD || !firstCVD || !lastPrice || !firstPrice) {
            return { type: null, strength: 0 };
        }

        // Calculate trends
        const cvdTrend = lastCVD.cvd - firstCVD.cvd;
        const priceTrend = lastPrice.price - firstPrice.price;

        // Normalize
        const cvdNorm = cvdTrend / Math.abs(firstCVD.cvd || 1);
        const priceNorm = priceTrend / firstPrice.price;

        // Detect divergence
        const threshold = 0.01; // 1% threshold

        if (priceNorm < -threshold && cvdNorm > threshold) {
            // Price down, CVD up → Bullish divergence
            return { type: 'bullish', strength: Math.abs(cvdNorm - priceNorm) };
        } else if (priceNorm > threshold && cvdNorm < -threshold) {
            // Price up, CVD down → Bearish divergence
            return { type: 'bearish', strength: Math.abs(cvdNorm - priceNorm) };
        }

        return { type: null, strength: 0 };
    }

    /**
     * Get buy/sell ratio for recent trades
     */
    getBuySellRatio(windowMs: number = 60000): number {
        const delta = this.calculateVolumeDelta(windowMs);
        return delta.sellVolume > 0 ? delta.buyVolume / delta.sellVolume : 0;
    }

    /**
     * Add trade to history with circular buffer
     */
    private addToHistory(trade: ClassifiedTrade): void {
        this.classifiedTrades.push(trade);

        if (this.classifiedTrades.length > this.maxHistorySize) {
            this.classifiedTrades.shift();
        }
    }

    /**
     * Get recent classified trades
     */
    getHistory(count: number = 100): ClassifiedTrade[] {
        return this.classifiedTrades.slice(-count);
    }

    /**
     * Reset classifier state
     */
    reset(): void {
        this.previousPrice = null;
        this.previousMidPrice = null;
        this.classifiedTrades = [];
    }
}
