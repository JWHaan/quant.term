import { IIndicatorPlugin } from '../../types/Plugin';
import { Candle } from '../../types/DataSource';

export const FractalDimensionPlugin: IIndicatorPlugin = {
    id: 'fractal-dimension',
    name: 'Fractal Dimension',
    description: 'Calculates the fractal dimension of the price series to measure trend persistence.',
    version: '1.0.0',
    author: 'QuantTerm',

    calculate(candles: Candle[], options: { period: number } = { period: 14 }): number[] {
        const period = options.period;
        const results: number[] = [];

        for (let i = 0; i < candles.length; i++) {
            if (i < period) {
                results.push(0);
                continue;
            }

            const slice = candles.slice(i - period, i + 1);
            if (slice.length === 0 || !slice[0]) continue;

            // Calculate High-Low range
            let highest = slice[0].high.toNumber();
            let lowest = slice[0].low.toNumber();

            for (const c of slice) {
                const h = c.high.toNumber();
                const l = c.low.toNumber();
                if (h > highest) highest = h;
                if (l < lowest) lowest = l;
            }

            const range = highest - lowest;
            if (range === 0) {
                results.push(1); // Flat line has dimension 1
                continue;
            }

            // Calculate path length
            let pathLength = 0;
            for (let j = 1; j < slice.length; j++) {
                const prevCandle = slice[j - 1];
                const currCandle = slice[j];
                if (!prevCandle || !currCandle) continue;
                const prev = prevCandle.close.toNumber();
                const curr = currCandle.close.toNumber();
                pathLength += Math.abs(curr - prev);
            }

            // Simplified Fractal Dimension: log(PathLength) / log(Range)
            // Note: This is a simplified proxy, not the strict Hausdorff dimension
            // Typically N = (L/k)^D -> D = log(N) / log(L/k)
            // Here we use a variation suitable for time series

            const dimension = Math.log(pathLength) / Math.log(range * period);
            results.push(dimension);
        }

        return results;
    }
};
