import { describe, it, expect } from 'vitest';
import { calculateSMA } from '../../utils/indicators';

describe('SMA Indicator', () => {
    // Test Data: Simple sequence 1-10
    const mockData = Array.from({ length: 10 }, (_, i) => ({
        time: i,
        open: i + 1,
        high: i + 1,
        low: i + 1,
        close: i + 1,
        volume: 100
    }));

    it('should calculate SMA correctly for period 5', () => {
        const result = calculateSMA(mockData, 5);

        // Expected:
        // Index 4 (Value 5): (1+2+3+4+5)/5 = 3
        // Index 5 (Value 6): (2+3+4+5+6)/5 = 4
        // ...
        // Index 9 (Value 10): (6+7+8+9+10)/5 = 8

        expect(result).toHaveLength(6); // 10 - 5 + 1
        expect(result[0]!.value).toBe(3);
        expect(result[result.length - 1]!.value).toBe(8);
    });

    it('should throw error if data length < period', () => {
        const shortData = mockData.slice(0, 3);
        expect(() => calculateSMA(shortData, 5)).toThrow();
    });

    it('should throw error on empty input', () => {
        expect(() => calculateSMA([], 5)).toThrow();
    });
});
