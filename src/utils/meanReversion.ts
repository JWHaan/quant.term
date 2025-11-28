import { Money } from '../types/Money';

export class MeanReversionIndicators {
    /**
     * Enhanced Bollinger Bands with multiple standard deviations
     */
    static bollingerBands(prices: Money[], period: number = 20, stdDevs: number[] = [1, 2, 3]): {
        middle: number[];
        bands: { [key: number]: { upper: number[]; lower: number[] } };
        percentB: number[];
        bandwidth: number[];
    } {
        const middle = this.SMA(prices, period);
        const bands: any = {};

        for (const std of stdDevs) {
            const { upper, lower } = this.calculateBands(prices, middle, period, std);
            bands[std] = { upper, lower };
        }

        // %B indicator: position within bands
        const percentB = prices.map((p, i) => {
            const price = p.toNumber();
            const upper = bands[2].upper[i];
            const lower = bands[2].lower[i];
            return (price - lower) / (upper - lower);
        });

        // Bandwidth: volatility measure
        const bandwidth = middle.map((m, i) => {
            const upper = bands[2].upper[i];
            const lower = bands[2].lower[i];
            return ((upper - lower) / m) * 100;
        });

        return { middle, bands, percentB, bandwidth };
    }

    /**
     * Pairs trading signal generator using cointegration
     */
    static pairsTradingSignal(
        assetA: Money[],
        assetB: Money[],
        lookback: number = 60
    ): {
        spread: number[];
        zScore: number[];
        signal: ('long_spread' | 'short_spread' | 'neutral')[];
        hedgeRatio: number;
    } {
        const pricesA = assetA.map(p => p.toNumber());
        const pricesB = assetB.map(p => p.toNumber());

        // Calculate hedge ratio (beta from regression)
        const hedgeRatio = this.calculateHedgeRatio(pricesA, pricesB);

        // Calculate spread
        const spread = pricesA.map((a, i) => a - hedgeRatio * pricesB[i]!);

        // Z-score of spread
        const zScore = this.rollingZScore(spread, lookback);

        // Generate signals
        const signal = zScore.map(z => {
            if (z > 2) return 'short_spread'; // Spread too high, short A / long B
            if (z < -2) return 'long_spread'; // Spread too low, long A / short B
            return 'neutral';
        });

        return { spread, zScore, signal, hedgeRatio };
    }

    private static SMA(prices: Money[], period: number): number[] {
        const sma = [];
        for (let i = 0; i < prices.length; i++) {
            if (i < period - 1) {
                sma.push(prices[i]!.toNumber());
                continue;
            }
            const slice = prices.slice(i - period + 1, i + 1);
            const avg = slice.reduce((sum, p) => sum.plus(p), Money.zero()).dividedBy(slice.length);
            sma.push(avg.toNumber());
        }
        return sma;
    }

    private static calculateBands(
        prices: Money[],
        middle: number[],
        period: number,
        stdDev: number
    ): { upper: number[]; lower: number[] } {
        const upper: number[] = [];
        const lower: number[] = [];

        for (let i = 0; i < prices.length; i++) {
            if (i < period - 1) {
                upper.push(middle[i]!);
                lower.push(middle[i]!);
                continue;
            }

            const slice = prices.slice(i - period + 1, i + 1).map(p => p.toNumber());
            const mean = middle[i]!;
            const variance = slice.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / period;
            const std = Math.sqrt(variance);

            upper.push(mean + stdDev * std);
            lower.push(mean - stdDev * std);
        }

        return { upper, lower };
    }

    private static calculateHedgeRatio(assetA: number[], assetB: number[]): number {
        const n = assetA.length;
        const meanA = assetA.reduce((a, b) => a + b, 0) / n;
        const meanB = assetB.reduce((a, b) => a + b, 0) / n;

        let num = 0;
        let den = 0;
        for (let i = 0; i < n; i++) {
            num += (assetA[i]! - meanA) * (assetB[i]! - meanB);
            den += Math.pow(assetB[i]! - meanB, 2);
        }

        return den === 0 ? 1 : num / den;
    }

    private static rollingZScore(values: number[], window: number): number[] {
        const zScores = [];

        for (let i = 0; i < values.length; i++) {
            if (i < window - 1) {
                zScores.push(0);
                continue;
            }

            const slice = values.slice(i - window + 1, i + 1);
            const mean = slice.reduce((a, b) => a + b, 0) / window;
            const std = Math.sqrt(
                slice.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / window
            );

            zScores.push(std === 0 ? 0 : (values[i]! - mean) / std);
        }

        return zScores;
    }
}
