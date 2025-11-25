/**
 * VPIN (Volume-Synchronized Probability of Informed Trading)
 * 
 * Measures the probability of informed trading (toxicity) in the order flow.
 * High VPIN indicates:
 * - Presence of informed traders
 * - Increased likelihood of volatility
 * - Potential liquidation cascades
 * 
 * Unlike traditional indicators that use time buckets, VPIN uses volume buckets,
 * making it more robust to varying market activity levels.
 * 
 * References:
 * - Easley, D., López de Prado, M. M., & O'Hara, M. (2012). Flow toxicity and liquidity in a high-frequency world
 * - Easley, D., López de Prado, M. M., & O'Hara, M. (2011). The microstructure of the "Flash Crash"
 */

import { ClassifiedTrade } from './tradeClassifier';

export interface VPINBucket {
    bucketNumber: number;
    buyVolume: number;
    sellVolume: number;
    totalVolume: number;
    imbalance: number;
    timestamp: number;
}

export interface VPINResult {
    vpin: number;              // VPIN value (0 to 1)
    toxicity: 'low' | 'medium' | 'high' | 'extreme';
    bucketsFilled: number;
    currentBucket: VPINBucket;
    timestamp: number;
}

export class VPINCalculator {
    private buckets: VPINBucket[] = [];
    private currentBucket: VPINBucket;
    private bucketNumber = 0;
    private readonly bucketSize: number;        // Volume per bucket (e.g., 100 BTC)
    private readonly numBuckets: number;        // Number of buckets for VPIN calculation (e.g., 50)
    private readonly maxHistorySize = 1000;

    /**
     * @param bucketSize - Volume threshold for each bucket (e.g., 100 for 100 BTC)
     * @param numBuckets - Number of buckets to use for VPIN calculation (default: 50)
     */
    constructor(bucketSize: number = 100, numBuckets: number = 50) {
        this.bucketSize = bucketSize;
        this.numBuckets = numBuckets;
        this.currentBucket = this.createNewBucket();
    }

    /**
     * Add a classified trade and update VPIN
     */
    addTrade(trade: ClassifiedTrade): VPINResult | null {
        const volume = trade.quantity;

        // Add to current bucket
        this.currentBucket.totalVolume += volume;

        if (trade.side === 'buy') {
            this.currentBucket.buyVolume += volume;
        } else {
            this.currentBucket.sellVolume += volume;
        }

        this.currentBucket.timestamp = trade.timestamp;

        // Check if bucket is full
        if (this.currentBucket.totalVolume >= this.bucketSize) {
            // Calculate imbalance for this bucket
            this.currentBucket.imbalance = Math.abs(
                this.currentBucket.buyVolume - this.currentBucket.sellVolume
            );

            // Add to history
            this.buckets.push(this.currentBucket);

            if (this.buckets.length > this.maxHistorySize) {
                this.buckets.shift();
            }

            // Start new bucket
            this.bucketNumber++;
            this.currentBucket = this.createNewBucket();

            // Calculate VPIN if we have enough buckets
            if (this.buckets.length >= this.numBuckets) {
                return this.calculateVPIN();
            }
        }

        return null;
    }

    /**
     * Calculate VPIN from recent buckets
     */
    private calculateVPIN(): VPINResult {
        // Use last N buckets
        const recentBuckets = this.buckets.slice(-this.numBuckets);

        // Sum of absolute order imbalances
        const sumImbalance = recentBuckets.reduce((sum, bucket) => sum + bucket.imbalance, 0);

        // Sum of total volume
        const sumVolume = recentBuckets.reduce((sum, bucket) => sum + bucket.totalVolume, 0);

        // VPIN = Sum(|Buy - Sell|) / Sum(Total Volume)
        const vpin = sumVolume > 0 ? sumImbalance / sumVolume : 0;

        // Classify toxicity level
        let toxicity: 'low' | 'medium' | 'high' | 'extreme';
        if (vpin < 0.3) {
            toxicity = 'low';
        } else if (vpin < 0.5) {
            toxicity = 'medium';
        } else if (vpin < 0.7) {
            toxicity = 'high';
        } else {
            toxicity = 'extreme';
        }

        return {
            vpin,
            toxicity,
            bucketsFilled: this.buckets.length,
            currentBucket: { ...this.currentBucket },
            timestamp: Date.now()
        };
    }

    /**
     * Get VPIN history for visualization
     */
    getVPINHistory(count: number = 100): Array<{ timestamp: number; vpin: number }> {
        const result: Array<{ timestamp: number; vpin: number }> = [];

        if (this.buckets.length < this.numBuckets) {
            return result;
        }

        // Calculate VPIN for each point in history
        for (let i = this.numBuckets; i <= this.buckets.length; i++) {
            const bucketSlice = this.buckets.slice(i - this.numBuckets, i);

            const sumImbalance = bucketSlice.reduce((sum, b) => sum + b.imbalance, 0);
            const sumVolume = bucketSlice.reduce((sum, b) => sum + b.totalVolume, 0);
            const vpin = sumVolume > 0 ? sumImbalance / sumVolume : 0;

            const lastBucket = bucketSlice[bucketSlice.length - 1];
            if (lastBucket) {
                result.push({
                    timestamp: lastBucket.timestamp,
                    vpin
                });
            }
        }

        return result.slice(-count);
    }

    /**
     * Detect VPIN spike (potential flash crash warning)
     */
    detectSpike(threshold: number = 0.7): boolean {
        if (this.buckets.length < this.numBuckets) {
            return false;
        }

        const current = this.calculateVPIN();
        return current.vpin > threshold;
    }

    /**
     * Get VPIN trend (increasing/decreasing toxicity)
     */
    getVPINTrend(lookback: number = 10): 'increasing' | 'decreasing' | 'stable' {
        const history = this.getVPINHistory(lookback + 1);

        if (history.length < 2) {
            return 'stable';
        }

        const recent = history.slice(-lookback);
        const older = history.slice(0, lookback);

        const recentAvg = recent.reduce((sum, h) => sum + h.vpin, 0) / recent.length;
        const olderAvg = older.reduce((sum, h) => sum + h.vpin, 0) / older.length;

        const change = recentAvg - olderAvg;
        const threshold = 0.05; // 5% threshold

        if (change > threshold) {
            return 'increasing';
        } else if (change < -threshold) {
            return 'decreasing';
        } else {
            return 'stable';
        }
    }

    /**
     * Create a new bucket
     */
    private createNewBucket(): VPINBucket {
        return {
            bucketNumber: this.bucketNumber,
            buyVolume: 0,
            sellVolume: 0,
            totalVolume: 0,
            imbalance: 0,
            timestamp: Date.now()
        };
    }

    /**
     * Get current bucket progress
     */
    getCurrentBucketProgress(): number {
        return (this.currentBucket.totalVolume / this.bucketSize) * 100;
    }

    /**
     * Reset calculator
     */
    reset(): void {
        this.buckets = [];
        this.currentBucket = this.createNewBucket();
        this.bucketNumber = 0;
    }
}
