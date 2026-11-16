/**
 * Tick Rule & Lee-Ready Trade Classification
 *
 * Classifies trades as buyer-initiated or seller-initiated using price movement rules.
 * This enables accurate Volume Delta (CVD) calculation.
 *
 * Implementation lives in the Rust/WASM core (`rust/quant-core`); this class is
 * a thin TypeScript wrapper preserving the original public API.
 *
 * References:
 * - Lee, C. M., & Ready, M. J. (1991). Inferring trade direction from intraday data
 * - Chakrabarty, B., Li, B., Nguyen, V., & Van Ness, R. A. (2007). Trade classification algorithms
 */

import { TradeClassifierCore } from '../wasm/quant-core/quant_core';

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
    private readonly core = new TradeClassifierCore();

    /**
     * Classify a trade using Tick Rule
     * If price > previous price → buy
     * If price < previous price → sell
     * If price = previous price → use previous classification (zero-tick rule)
     */
    classifyByTickRule(trade: Trade): ClassifiedTrade {
        return this.core.classifyByTickRule(trade) as ClassifiedTrade;
    }

    /**
     * Binance exposes whether the buyer was the maker. The taker is therefore
     * the aggressive side and is a better classification source than inferring
     * direction from price ticks.
     */
    classifyFromExchange(trade: Trade): ClassifiedTrade {
        return this.core.classifyFromExchange(trade) as ClassifiedTrade;
    }

    /**
     * Classify using Lee-Ready algorithm (requires order book mid-price)
     * If trade price > mid-price → buy
     * If trade price < mid-price → sell
     * If trade price = mid-price → use tick rule
     */
    classifyByLeeReady(trade: Trade, currentMidPrice: number): ClassifiedTrade {
        return this.core.classifyByLeeReady(trade, currentMidPrice) as ClassifiedTrade;
    }

    /**
     * Calculate Volume Delta for a time window
     */
    calculateVolumeDelta(windowMs: number = 60000): VolumeDelta {
        return this.core.calculateVolumeDelta(windowMs) as VolumeDelta;
    }

    /**
     * Get cumulative volume delta (CVD) over time
     */
    getCumulativeVolumeDelta(intervalMs: number = 60000): Array<{ timestamp: number; cvd: number }> {
        return this.core.getCumulativeVolumeDelta(intervalMs) as Array<{ timestamp: number; cvd: number }>;
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
        return this.core.detectDivergence(priceData) as {
            type: 'bullish' | 'bearish' | null;
            strength: number;
        };
    }

    /**
     * Get buy/sell ratio for recent trades
     */
    getBuySellRatio(windowMs: number = 60000): number {
        return this.core.getBuySellRatio(windowMs);
    }

    /**
     * Get recent classified trades
     */
    getHistory(count: number = 100): ClassifiedTrade[] {
        return this.core.getHistory(count) as ClassifiedTrade[];
    }

    /**
     * Reset classifier state
     */
    reset(): void {
        this.core.reset();
    }
}
