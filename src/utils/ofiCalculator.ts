/**
 * Order Flow Imbalance (OFI) Calculator
 * 
 * Computes real-time order flow imbalance to detect aggressive buying/selling
 * Formula: OFI = (BidVolume↑ - AskVolume↓) / TotalVolume
 * 
 * References:
 * - Cartea, Á., Jaimungal, S., & Penalva, J. (2015). Algorithmic and High-Frequency Trading
 * - Cont, R., Kukanov, A., & Stoikov, S. (2014). The Price Impact of Order Book Events
 */

export interface OrderBookSnapshot {
    bids: [string, string][]; // [price, quantity]
    asks: [string, string][];
    timestamp: number;
}

export interface OFIResult {
    ofi: number;           // Order flow imbalance (-1 to 1)
    bidPressure: number;   // Bid volume increase
    askPressure: number;   // Ask volume decrease
    totalVolume: number;   // Total volume change
    timestamp: number;
}

export class OFICalculator {
    private previousSnapshot: OrderBookSnapshot | null = null;
    private ofiHistory: OFIResult[] = [];
    private readonly maxHistorySize = 1000; // ~100 seconds at 100ms updates

    /**
     * Calculate OFI from current and previous order book snapshots
     */
    calculate(currentSnapshot: OrderBookSnapshot): OFIResult | null {
        if (!this.previousSnapshot) {
            this.previousSnapshot = currentSnapshot;
            return null;
        }

        const bidPressure = this.calculateBidPressure(
            this.previousSnapshot.bids,
            currentSnapshot.bids
        );

        const askPressure = this.calculateAskPressure(
            this.previousSnapshot.asks,
            currentSnapshot.asks
        );

        const totalVolume = Math.abs(bidPressure) + Math.abs(askPressure);

        // OFI normalized to [-1, 1]
        const ofi = totalVolume > 0
            ? (bidPressure - askPressure) / totalVolume
            : 0;

        const result: OFIResult = {
            ofi,
            bidPressure,
            askPressure,
            totalVolume,
            timestamp: currentSnapshot.timestamp
        };

        // Update history
        this.ofiHistory.push(result);
        if (this.ofiHistory.length > this.maxHistorySize) {
            this.ofiHistory.shift();
        }

        this.previousSnapshot = currentSnapshot;
        return result;
    }

    /**
     * Calculate bid-side pressure (volume increase at bid levels)
     */
    private calculateBidPressure(
        previousBids: [string, string][],
        currentBids: [string, string][]
    ): number {
        const prevMap = new Map<string, number>();
        previousBids.forEach(([price, qty]) => {
            prevMap.set(price, parseFloat(qty));
        });

        let pressure = 0;
        currentBids.forEach(([price, qty]) => {
            const currentQty = parseFloat(qty);
            const previousQty = prevMap.get(price) || 0;
            const delta = currentQty - previousQty;

            // Only count increases (new liquidity added)
            if (delta > 0) {
                pressure += delta;
            }
        });

        return pressure;
    }

    /**
     * Calculate ask-side pressure (volume decrease at ask levels)
     */
    private calculateAskPressure(
        previousAsks: [string, string][],
        currentAsks: [string, string][]
    ): number {
        const prevMap = new Map<string, number>();
        previousAsks.forEach(([price, qty]) => {
            prevMap.set(price, parseFloat(qty));
        });

        let pressure = 0;
        currentAsks.forEach(([price, qty]) => {
            const currentQty = parseFloat(qty);
            const previousQty = prevMap.get(price) || 0;
            const delta = previousQty - currentQty;

            // Only count decreases (liquidity removed by aggressive buyers)
            if (delta > 0) {
                pressure += delta;
            }
        });

        return pressure;
    }

    /**
     * Get moving average of OFI over specified window
     */
    getOFIMovingAverage(windowSize: number = 10): number {
        if (this.ofiHistory.length === 0) return 0;

        const window = this.ofiHistory.slice(-windowSize);
        const sum = window.reduce((acc, result) => acc + result.ofi, 0);
        return sum / window.length;
    }

    /**
     * Get OFI standard deviation (volatility measure)
     */
    getOFIStdDev(windowSize: number = 10): number {
        if (this.ofiHistory.length < 2) return 0;

        const window = this.ofiHistory.slice(-windowSize);
        const mean = window.reduce((acc, r) => acc + r.ofi, 0) / window.length;
        const variance = window.reduce((acc, r) => acc + Math.pow(r.ofi - mean, 2), 0) / window.length;
        return Math.sqrt(variance);
    }

    /**
     * Detect significant OFI events (>2 std deviations)
     */
    detectSignificantEvent(): { type: 'buy' | 'sell' | null; magnitude: number } {
        if (this.ofiHistory.length < 10) {
            return { type: null, magnitude: 0 };
        }

        const latest = this.ofiHistory[this.ofiHistory.length - 1];
        if (!latest) {
            return { type: null, magnitude: 0 };
        }

        const mean = this.getOFIMovingAverage(10);
        const stdDev = this.getOFIStdDev(10);

        if (stdDev === 0) return { type: null, magnitude: 0 };

        const zScore = (latest.ofi - mean) / stdDev;

        if (zScore > 2) {
            return { type: 'buy', magnitude: zScore };
        } else if (zScore < -2) {
            return { type: 'sell', magnitude: Math.abs(zScore) };
        }

        return { type: null, magnitude: 0 };
    }

    /**
     * Get recent OFI history for visualization
     */
    getHistory(count: number = 100): OFIResult[] {
        return this.ofiHistory.slice(-count);
    }

    /**
     * Reset calculator state
     */
    reset(): void {
        this.previousSnapshot = null;
        this.ofiHistory = [];
    }
}
