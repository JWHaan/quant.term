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
 * Implementation lives in the Rust/WASM core (`rust/quant-core`); this class is
 * a thin TypeScript wrapper preserving the original public API.
 *
 * References:
 * - Easley, D., López de Prado, M. M., & O'Hara, M. (2012). Flow toxicity and liquidity in a high-frequency world
 * - Easley, D., López de Prado, M. M., & O'Hara, M. (2011). The microstructure of the "Flash Crash"
 */

import { VpinCalculatorCore } from '../wasm/quant-core/quant_core';
import type { ClassifiedTrade } from './tradeClassifier';

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
    private readonly core: VpinCalculatorCore;

    /**
     * @param bucketSize - Volume threshold for each bucket (e.g., 100 for 100 BTC)
     * @param numBuckets - Number of buckets to use for VPIN calculation (default: 50)
     */
    constructor(bucketSize: number = 100, numBuckets: number = 50) {
        this.core = new VpinCalculatorCore(bucketSize, numBuckets);
    }

    /**
     * Add a classified trade and update VPIN
     */
    addTrade(trade: ClassifiedTrade): VPINResult | null {
        return this.core.addTrade(trade) as VPINResult | null;
    }

    /**
     * Get VPIN history for visualization
     */
    getVPINHistory(count: number = 100): Array<{ timestamp: number; vpin: number }> {
        return this.core.getVPINHistory(count) as Array<{ timestamp: number; vpin: number }>;
    }

    /**
     * Detect VPIN spike (potential flash crash warning)
     */
    detectSpike(threshold: number = 0.7): boolean {
        return this.core.detectSpike(threshold);
    }

    /**
     * Get VPIN trend (increasing/decreasing toxicity)
     */
    getVPINTrend(lookback: number = 10): 'increasing' | 'decreasing' | 'stable' {
        return this.core.getVPINTrend(lookback) as 'increasing' | 'decreasing' | 'stable';
    }

    /**
     * Get current bucket progress
     */
    getCurrentBucketProgress(): number {
        return this.core.getCurrentBucketProgress();
    }

    /**
     * Reset calculator
     */
    reset(): void {
        this.core.reset();
    }
}
