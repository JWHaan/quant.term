import { describe, it, expect } from 'vitest';
import { calculateMACD } from '../../utils/indicators';

describe('MACD Indicator', () => {
    it('should calculate MACD components', () => {
        // Generate some volatile data
        const mockData = Array.from({ length: 50 }, (_, i) => ({
            time: i,
            close: Math.sin(i / 5) * 10 + 100, // Sine wave around 100
            open: 100, high: 110, low: 90, volume: 100
        }));

        const result = calculateMACD(mockData);

        expect(result.length).toBeGreaterThan(0);

        const lastPoint = result[result.length - 1]!;

        expect(lastPoint).toHaveProperty('macd');
        expect(lastPoint).toHaveProperty('signal');
        expect(lastPoint).toHaveProperty('histogram');

        // Histogram should be MACD - Signal
        expect(lastPoint.histogram).toBeCloseTo(lastPoint.macd - lastPoint.signal, 5);
    });
});
