import { describe, it, expect } from 'vitest';
import { calculateVWAP } from '@/utils/indicators';

describe('calculateVWAP', () => {
    it('should calculate VWAP correctly for sample data', () => {
        const data = [
            { time: 1, open: 100, high: 105, low: 99, close: 103, volume: 1000 },
            { time: 2, open: 103, high: 107, low: 102, close: 106, volume: 1500 },
            { time: 3, open: 106, high: 108, low: 104, close: 105, volume: 1200 },
        ];

        const result = calculateVWAP(data);

        expect(result).toHaveLength(3);
        expect(result[0]?.time).toBe(1);

        // First VWAP: (102.33 * 1000) / 1000 = 102.33
        expect(result[0]?.value).toBeCloseTo(102.33, 2);

        // Second VWAP: cumulative
        expect(result[1]?.value).toBeGreaterThan(102);
        expect(result[1]?.value).toBeLessThan(106);
    });

    it('should throw error on empty array', () => {
        expect(() => calculateVWAP([])).toThrow('Insufficient data');
    });

    it('should handle single data point', () => {
        const data = [
            { time: 1, open: 100, high: 105, low: 99, close: 103, volume: 1000 }
        ];

        const result = calculateVWAP(data);
        expect(result).toHaveLength(1);
        expect(result[0]?.value).toBeCloseTo(102.33, 2);
    });

    it('should accumulate volume correctly', () => {
        const data = [
            { time: 1, open: 100, high: 100, low: 100, close: 100, volume: 100 },
            { time: 2, open: 200, high: 200, low: 200, close: 200, volume: 100 },
        ];

        const result = calculateVWAP(data);

        // VWAP should be weighted average: (100*100 + 200*100) / 200 = 150
        expect(result[1]?.value).toBeCloseTo(150, 2);
    });

    it('should handle zero volume gracefully', () => {
        const data = [
            { time: 1, open: 100, high: 105, low: 99, close: 103, volume: 0 },
        ];

        const result = calculateVWAP(data);
        expect(result).toHaveLength(1);
        // Should handle division by zero
        const value = result[0]?.value;
        expect(value !== undefined && (Number.isFinite(value) || Number.isNaN(value))).toBe(true);
    });
});
