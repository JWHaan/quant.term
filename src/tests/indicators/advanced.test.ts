import { describe, it, expect, vi } from 'vitest';
import { calculateOFI, calculateOBV, calculateADX, calculateHurst } from '@/utils/indicators';

describe('calculateOFI', () => {
    it('should calculate order flow imbalance correctly', () => {
        const trades = [
            { quantity: 10, isBuyerMaker: false }, // Buy
            { quantity: 5, isBuyerMaker: true },   // Sell
            { quantity: 15, isBuyerMaker: false }, // Buy
        ];

        const result = calculateOFI(trades);

        expect(result.buyVolume).toBe(25);
        expect(result.sellVolume).toBe(5);
        expect(result.netVolume).toBe(20);
        expect(result.imbalanceRatio).toBeCloseTo(0.667, 2);
    });

    it('should handle string quantities', () => {
        const trades = [
            { quantity: '10.5', isBuyerMaker: false },
            { quantity: '5.5', isBuyerMaker: true },
        ];

        const result = calculateOFI(trades);

        expect(result.buyVolume).toBe(10.5);
        expect(result.sellVolume).toBe(5.5);
    });

    it('should handle invalid quantities with warning', () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

        const trades = [
            { quantity: NaN, isBuyerMaker: false },
            { quantity: Infinity, isBuyerMaker: true },
            { quantity: 10, isBuyerMaker: false },
        ];

        const result = calculateOFI(trades);

        expect(result.buyVolume).toBe(10);
        expect(result.sellVolume).toBe(0);
        expect(consoleSpy).toHaveBeenCalledTimes(2);

        consoleSpy.mockRestore();
    });

    it('should return zeros for empty trades', () => {
        const result = calculateOFI([]);

        expect(result.buyVolume).toBe(0);
        expect(result.sellVolume).toBe(0);
        expect(result.netVolume).toBe(0);
        expect(result.imbalanceRatio).toBe(0);
    });

    it('should calculate -1 ratio for all sells', () => {
        const trades = [
            { quantity: 10, isBuyerMaker: true },
            { quantity: 5, isBuyerMaker: true },
        ];

        const result = calculateOFI(trades);

        expect(result.imbalanceRatio).toBe(-1);
    });

    it('should calculate +1 ratio for all buys', () => {
        const trades = [
            { quantity: 10, isBuyerMaker: false },
            { quantity: 5, isBuyerMaker: false },
        ];

        const result = calculateOFI(trades);

        expect(result.imbalanceRatio).toBe(1);
    });
});

describe('calculateOBV', () => {
    it('should calculate OBV correctly', () => {
        const data = [
            { time: 1, open: 100, high: 105, low: 99, close: 103, volume: 1000 },
            { time: 2, open: 103, high: 107, low: 102, close: 106, volume: 1500 }, // Up
            { time: 3, open: 106, high: 108, low: 104, close: 105, volume: 1200 }, // Down
            { time: 4, open: 105, high: 109, low: 104, close: 108, volume: 1800 }, // Up
        ];

        const result = calculateOBV(data);

        expect(result).toHaveLength(4);
        expect(result[0]?.value).toBe(0); // Initial
        expect(result[1]?.value).toBe(1500); // +1500
        expect(result[2]?.value).toBe(300); // -1200
        expect(result[3]?.value).toBe(2100); // +1800
    });

    it('should keep OBV same when price unchanged', () => {
        const data = [
            { time: 1, open: 100, high: 105, low: 99, close: 100, volume: 1000 },
            { time: 2, open: 100, high: 105, low: 99, close: 100, volume: 1500 }, // Same
        ];

        const result = calculateOBV(data);

        expect(result[0]?.value).toBe(0);
        expect(result[1]?.value).toBe(0); // Unchanged
    });

    it('should throw error on empty data', () => {
        expect(() => calculateOBV([])).toThrow('Insufficient data');
    });
});

describe('calculateADX', () => {
    it('should calculate ADX for trending data', () => {
        // Create trending data
        const data = [];
        for (let i = 0; i < 50; i++) {
            data.push({
                time: i,
                open: 100 + i,
                high: 105 + i,
                low: 99 + i,
                close: 103 + i,
                volume: 1000
            });
        }

        const result = calculateADX(data, 14);

        expect(result.length).toBeGreaterThan(0);
        expect(result[0]?.value).toBeGreaterThanOrEqual(0);
        expect(result[0]?.value).toBeLessThanOrEqual(100);
    });

    it('should throw error on insufficient data', () => {
        const data = [
            { time: 1, open: 100, high: 105, low: 99, close: 103, volume: 1000 },
        ];

        expect(() => calculateADX(data, 14)).toThrow('Insufficient data');
    });
});

describe('calculateHurst', () => {
    it('should return 0.5 for insufficient data', () => {
        const data = [
            { time: 1, open: 100, high: 105, low: 99, close: 103, volume: 1000 },
        ];

        const result = calculateHurst(data);

        expect(result).toBe(0.5);
    });

    it('should calculate Hurst exponent for trending data', () => {
        // Create trending data (should have H > 0.5)
        const data = [];
        for (let i = 0; i < 150; i++) {
            data.push({
                time: i,
                open: 100 + i * 0.5,
                high: 105 + i * 0.5,
                low: 99 + i * 0.5,
                close: 103 + i * 0.5,
                volume: 1000
            });
        }

        const result = calculateHurst(data);

        expect(result).toBeGreaterThan(0);
        expect(result).toBeLessThan(2);
    });

    it('should handle zero standard deviation', () => {
        // All same prices
        const data = [];
        for (let i = 0; i < 150; i++) {
            data.push({
                time: i,
                open: 100,
                high: 100,
                low: 100,
                close: 100,
                volume: 1000
            });
        }

        const result = calculateHurst(data);

        expect(result).toBe(0.5);
    });
});
