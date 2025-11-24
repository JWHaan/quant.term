import { describe, it, expect } from 'vitest';
import { calculateBollingerBands } from '../../utils/indicators';

describe('Bollinger Bands Indicator', () => {
    it('should calculate bands correctly', () => {
        // Constant price should result in bands equal to price (std dev = 0)
        const constantData = Array.from({ length: 30 }, (_, i) => ({
            time: i,
            close: 100,
            open: 100, high: 100, low: 100, volume: 100
        }));

        const result = calculateBollingerBands(constantData, 20, 2);
        const lastPoint = result[result.length - 1]!;

        expect(lastPoint.middle).toBe(100);
        expect(lastPoint.upper).toBe(100);
        expect(lastPoint.lower).toBe(100);
    });

    it('should widen bands with volatility', () => {
        // Alternating prices: 90, 110, 90, 110...
        const volatileData = Array.from({ length: 30 }, (_, i) => ({
            time: i,
            close: i % 2 === 0 ? 90 : 110,
            open: 100, high: 110, low: 90, volume: 100
        }));

        const result = calculateBollingerBands(volatileData, 20, 2);
        const lastPoint = result[result.length - 1]!;

        // Mean should be 100
        expect(lastPoint.middle).toBeCloseTo(100, 0);

        // Std Dev of 90, 110 is 10.
        // Upper = 100 + 2*10 = 120
        // Lower = 100 - 2*10 = 80

        expect(lastPoint.upper).toBeCloseTo(120, 0);
        expect(lastPoint.lower).toBeCloseTo(80, 0);
    });
});
