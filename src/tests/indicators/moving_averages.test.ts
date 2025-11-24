import { describe, it, expect } from 'vitest';
import { calculateSMA, calculateEMA } from '@/utils/indicators';

describe('calculateSMA', () => {
    it('should calculate SMA correctly', () => {
        const data = [
            { time: 1, open: 10, high: 12, low: 9, close: 11, volume: 100 },
            { time: 2, open: 11, high: 13, low: 10, close: 12, volume: 100 },
            { time: 3, open: 12, high: 14, low: 11, close: 13, volume: 100 },
            { time: 4, open: 13, high: 15, low: 12, close: 14, volume: 100 },
            { time: 5, open: 14, high: 16, low: 13, close: 15, volume: 100 },
        ];

        const result = calculateSMA(data, 3);

        expect(result).toHaveLength(3);
        expect(result[0]?.time).toBe(3);
        expect(result[0]?.value).toBe(12); // (11 + 12 + 13) / 3
        expect(result[1]?.value).toBe(13); // (12 + 13 + 14) / 3
        expect(result[2]?.value).toBe(14); // (13 + 14 + 15) / 3
    });

    it('should throw error on empty array', () => {
        expect(() => calculateSMA([], 14)).toThrow('Insufficient data');
    });

    it('should throw error on insufficient data', () => {
        const data = [
            { time: 1, open: 10, high: 12, low: 9, close: 11, volume: 100 },
            { time: 2, open: 11, high: 13, low: 10, close: 12, volume: 100 },
        ];

        expect(() => calculateSMA(data, 5)).toThrow('Insufficient data');
    });

    it('should calculate SMA(1) as close prices', () => {
        const data = [
            { time: 1, open: 10, high: 12, low: 9, close: 11, volume: 100 },
            { time: 2, open: 11, high: 13, low: 10, close: 12, volume: 100 },
        ];

        const result = calculateSMA(data, 1);
        expect(result).toHaveLength(2);
        expect(result[0]?.value).toBe(11);
        expect(result[1]?.value).toBe(12);
    });
});

describe('calculateEMA', () => {
    it('should calculate EMA correctly', () => {
        const data = [
            { time: 1, open: 10, high: 12, low: 9, close: 10, volume: 100 },
            { time: 2, open: 10, high: 12, low: 9, close: 11, volume: 100 },
            { time: 3, open: 11, high: 13, low: 10, close: 12, volume: 100 },
            { time: 4, open: 12, high: 14, low: 11, close: 13, volume: 100 },
            { time: 5, open: 13, high: 15, low: 12, close: 14, volume: 100 },
        ];

        const result = calculateEMA(data, 3);

        expect(result).toHaveLength(3);
        expect(result[0]?.time).toBe(3);

        // First EMA is SMA: (10 + 11 + 12) / 3 = 11
        expect(result[0]?.value).toBe(11);

        // Second EMA: (13 * 0.5) + (11 * 0.5) = 12
        expect(result[1]?.value).toBe(12);

        // Third EMA: (14 * 0.5) + (12 * 0.5) = 13
        expect(result[2]?.value).toBe(13);
    });

    it('should be more responsive than SMA', () => {
        const data = [
            { time: 1, open: 10, high: 12, low: 9, close: 10, volume: 100 },
            { time: 2, open: 10, high: 12, low: 9, close: 10, volume: 100 },
            { time: 3, open: 10, high: 12, low: 9, close: 10, volume: 100 },
            { time: 4, open: 10, high: 12, low: 9, close: 20, volume: 100 }, // Spike
        ];

        const sma = calculateSMA(data, 3);
        const ema = calculateEMA(data, 3);

        // EMA should react more to the spike than SMA
        expect(ema[ema.length - 1]?.value).toBeGreaterThan(sma[sma.length - 1]?.value ?? 0);
    });

    it('should throw error on empty array', () => {
        expect(() => calculateEMA([], 14)).toThrow('Insufficient data');
    });

    it('should throw error on insufficient data', () => {
        const data = [
            { time: 1, open: 10, high: 12, low: 9, close: 11, volume: 100 },
        ];

        expect(() => calculateEMA(data, 5)).toThrow('Insufficient data');
    });
});
