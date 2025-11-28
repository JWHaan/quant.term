import { Money } from '../types/Money';

export class EnhancedIndicators {
    /**
     * RSI with Z-Score normalization and divergence detection
     */
    static RSIEnhanced(prices: Money[], period: number = 14): {
        rsi: number[];
        zScore: number[];
        divergence: ('bullish' | 'bearish' | null)[];
    } {
        const rsiValues = this.calculateRSI(prices, period);
        const zScores = this.calculateZScore(rsiValues, 20);
        const divergences = this.detectDivergence(prices, rsiValues);

        return { rsi: rsiValues, zScore: zScores, divergence: divergences };
    }

    /**
     * MACD with histogram z-score and signal line crossovers
     */
    static MACDEnhanced(prices: Money[], fast: number = 12, slow: number = 26, signal: number = 9): {
        macd: number[];
        signal: number[];
        histogram: number[];
        histogramZScore: number[];
        crossovers: ('bullish' | 'bearish' | null)[];
    } {
        const emaFast = this.EMA(prices, fast);
        const emaSlow = this.EMA(prices, slow);

        const macd = emaFast.map((f, i) => f - emaSlow[i]!);

        // Calculate signal line EMA on MACD values (already numbers)
        const signalLine = this.EMANumbers(macd, signal);
        const histogram = macd.map((m, i) => m - signalLine[i]!);

        const histogramZScore = this.calculateZScore(histogram, 20);
        const crossovers = this.detectCrossovers(macd, signalLine);

        return {
            macd,
            signal: signalLine,
            histogram,
            histogramZScore,
            crossovers
        };
    }

    /**
     * Adaptive Moving Average using volatility-based period adjustment
     */
    static adaptiveMA(prices: Money[], minPeriod: number = 5, maxPeriod: number = 50): number[] {
        const returns = prices.slice(1).map((p, i) =>
            p.minus(prices[i]!).dividedBy(prices[i]!).toNumber()
        );

        const volatility = this.rollingStd(returns, 20);
        const results = [];

        for (let i = 0; i < prices.length; i++) {
            const vol = volatility[i] || 0.01;
            // Higher volatility -> shorter period (more responsive)
            const period = Math.round(minPeriod + (maxPeriod - minPeriod) * (1 - Math.min(vol * 100, 1)));

            const start = Math.max(0, i - period + 1);
            const slice = prices.slice(start, i + 1);
            const avg = slice.reduce((sum, p) => sum.plus(p), Money.zero()).dividedBy(slice.length);
            results.push(avg.toNumber());
        }

        return results;
    }

    private static calculateRSI(prices: Money[], period: number): number[] {
        const changes = prices.slice(1).map((p, i) => p.minus(prices[i]!).toNumber());
        const rsi = [];

        for (let i = 0; i < changes.length; i++) {
            if (i < period - 1) {
                rsi.push(50);
                continue;
            }

            const slice = changes.slice(i - period + 1, i + 1);
            const gains = slice.filter(c => c > 0).reduce((sum, c) => sum + c, 0) / period;
            const losses = Math.abs(slice.filter(c => c < 0).reduce((sum, c) => sum + c, 0)) / period;

            if (losses === 0) {
                rsi.push(100);
            } else {
                const rs = gains / losses;
                rsi.push(100 - (100 / (1 + rs)));
            }
        }

        return [50, ...rsi];
    }

    private static calculateZScore(values: number[], window: number): number[] {
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

    private static detectDivergence(prices: Money[], indicator: number[]): ('bullish' | 'bearish' | null)[] {
        const divergences: ('bullish' | 'bearish' | null)[] = [];
        const lookback = 5;

        for (let i = 0; i < prices.length; i++) {
            if (i < lookback * 2) {
                divergences.push(null);
                continue;
            }

            const priceSlice = prices.slice(i - lookback, i + 1).map(p => p.toNumber());
            const indSlice = indicator.slice(i - lookback, i + 1);

            const priceMin = Math.min(...priceSlice);
            const priceMax = Math.max(...priceSlice);
            const indMin = Math.min(...indSlice);
            const indMax = Math.max(...indSlice);

            // Bullish divergence: price makes lower low, indicator makes higher low
            if (priceSlice[priceSlice.length - 1] === priceMin &&
                indSlice[indSlice.length - 1]! > indMin) {
                divergences.push('bullish');
            }
            // Bearish divergence: price makes higher high, indicator makes lower high
            else if (priceSlice[priceSlice.length - 1] === priceMax &&
                indSlice[indSlice.length - 1]! < indMax) {
                divergences.push('bearish');
            } else {
                divergences.push(null);
            }
        }

        return divergences;
    }

    private static detectCrossovers(line1: number[], line2: number[]): ('bullish' | 'bearish' | null)[] {
        const crossovers: ('bullish' | 'bearish' | null)[] = [null];

        for (let i = 1; i < line1.length; i++) {
            if (line1[i - 1]! <= line2[i - 1]! && line1[i]! > line2[i]!) {
                crossovers.push('bullish');
            } else if (line1[i - 1]! >= line2[i - 1]! && line1[i]! < line2[i]!) {
                crossovers.push('bearish');
            } else {
                crossovers.push(null);
            }
        }

        return crossovers;
    }

    private static EMA(prices: Money[], period: number): number[] {
        const k = 2 / (period + 1);
        if (prices.length === 0) return [];
        const ema = [prices[0]!.toNumber()];

        for (let i = 1; i < prices.length; i++) {
            ema.push(prices[i]!.toNumber() * k + ema[i - 1]! * (1 - k));
        }

        return ema;
    }

    private static EMANumbers(values: number[], period: number): number[] {
        const k = 2 / (period + 1);
        if (values.length === 0) return [];
        const ema = [values[0]!];

        for (let i = 1; i < values.length; i++) {
            ema.push(values[i]! * k + ema[i - 1]! * (1 - k));
        }

        return ema;
    }

    private static rollingStd(values: number[], window: number): number[] {
        const stds = [];

        for (let i = 0; i < values.length; i++) {
            if (i < window - 1) {
                stds.push(0);
                continue;
            }

            const slice = values.slice(i - window + 1, i + 1);
            const mean = slice.reduce((a, b) => a + b, 0) / window;
            const variance = slice.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / window;
            stds.push(Math.sqrt(variance));
        }

        return stds;
    }
}
