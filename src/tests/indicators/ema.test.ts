import { describe, it, expect } from 'vitest';
import { calculateEMA } from '../../utils/indicators';

describe('EMA Indicator', () => {
    const mockData = Array.from({ length: 10 }, (_, i) => ({
        time: i,
        open: 10,
        high: 10,
        low: 10,
        close: 10, // Constant price
        volume: 100
    }));

    it('should return constant EMA for constant price', () => {
        const result = calculateEMA(mockData, 5);
        // EMA of a constant series should eventually be that constant
        // Since we seed with SMA (which is also 10), it should be 10 from the start
        expect(result[0]!.value).toBe(10);
        expect(result[result.length - 1]!.value).toBe(10);
    });

    it('should react to price changes', () => {
        const trendData = Array.from({ length: 10 }, (_, i) => ({
            time: i,
            open: i * 10,
            high: i * 10,
            low: i * 10,
            close: i * 10,
            volume: 100
        }));

        const result = calculateEMA(trendData, 5);
        // EMA should lag behind price in an uptrend
        const lastPrice = trendData[9]!.close; // 90
        const lastEMA = result[result.length - 1]!.value;

        expect(lastEMA).toBeLessThan(lastPrice);
    });
});
