import { describe, it, expect } from 'vitest';
import { calculateRSI } from '../../utils/indicators';

describe('RSI Indicator', () => {
    it('should calculate RSI correctly', () => {
        // Create a sequence that goes up then down
        // Up: 10, 11, 12, 13, 14, 15 (5 gains of 1)
        // Down: 15, 14, 13, 12, 11, 10 (5 losses of 1)

        const prices = [
            10, 11, 12, 13, 14, 15, // Gain phase
            14, 13, 12, 11, 10,      // Loss phase
            11, 12, 13, 14, 15, 16, 17, 18, 19, 20 // Strong gain phase
        ];

        const mockData = prices.map((p, i) => ({
            time: i,
            open: p,
            high: p,
            low: p,
            close: p,
            volume: 100
        }));

        const result = calculateRSI(mockData, 14);

        // We need at least 14 periods + 1 for change calc = 15 points to get first RSI
        // Our data has 21 points.

        expect(result.length).toBeGreaterThan(0);

        const lastRSI = result[result.length - 1]!.value;
        // In the strong gain phase at the end, RSI should be high (> 70)
        expect(lastRSI).toBeGreaterThan(70);
        expect(lastRSI).toBeLessThanOrEqual(100);
    });

    it('should return 100 for continuous uptrend', () => {
        const uptrend = Array.from({ length: 30 }, (_, i) => ({
            time: i,
            close: i,
            open: i, high: i, low: i, volume: 100
        }));

        const result = calculateRSI(uptrend, 14);
        const lastRSI = result[result.length - 1]!.value;

        // Pure uptrend RSI approaches 100
        expect(lastRSI).toBeGreaterThan(95);
    });

    it('should return 0 for continuous downtrend', () => {
        const downtrend = Array.from({ length: 30 }, (_, i) => ({
            time: i,
            close: 100 - i,
            open: 100 - i, high: 100 - i, low: 100 - i, volume: 100
        }));

        const result = calculateRSI(downtrend, 14);
        const lastRSI = result[result.length - 1]!.value;

        // Pure downtrend RSI approaches 0
        expect(lastRSI).toBeLessThan(5);
    });
});
