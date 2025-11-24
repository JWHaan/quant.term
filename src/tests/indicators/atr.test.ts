import { describe, it, expect } from 'vitest';
import { calculateATR } from '../../utils/indicators';

describe('ATR Indicator', () => {
    it('should calculate ATR correctly', () => {
        // TR is max(H-L, |H-Cp|, |L-Cp|)
        // Let's make H-L constant at 10, and moves small so H-L is the TR

        const mockData = Array.from({ length: 20 }, (_, i) => ({
            time: i,
            high: 110,
            low: 100,
            close: 105,
            open: 105,
            volume: 100
        }));

        // TR is always 10. ATR should be 10.
        const result = calculateATR(mockData, 14);
        const lastATR = result[result.length - 1]!.value;

        expect(lastATR).toBeCloseTo(10, 1);
    });

    it('should account for gaps (True Range)', () => {
        // Day 1: Close 100
        // Day 2: Open 120, High 130, Low 125, Close 125
        // H-L = 5
        // |H-Cp| = |130-100| = 30
        // |L-Cp| = |125-100| = 25
        // TR should be 30


        // ATR period 1 for simplicity (just returns TR)
        // Note: calculateATR usually needs period+1 data to start smoothing, 
        // or handles initial values. Let's check implementation behavior with short data.
        // If implementation uses Wilder's smoothing, it needs more data.
        // Let's stick to a longer sequence where the gap repeats.

        const gapData: any[] = [{ time: 0, open: 100, high: 100, low: 100, close: 100, volume: 100 }];

        for (let i = 1; i < 20; i++) {
            const prevClose = gapData[i - 1].close;
            // We want TR to be 30.
            // Let's make H-L = 5.
            // We need |High - PrevClose| = 30.
            // So High = PrevClose + 30.
            const currentHigh = prevClose + 30;
            const currentLow = currentHigh - 5;
            const currentClose = currentLow;

            gapData.push({
                time: i,
                open: currentHigh,
                high: currentHigh,
                low: currentLow,
                close: currentClose,
                volume: 100
            });
        }

        // TR is dominated by the gap (30) rather than H-L (5)
        const result = calculateATR(gapData, 14);
        const lastATR = result[result.length - 1]!.value;

        expect(lastATR).toBeGreaterThan(20); // Should be closer to 30 than 5
    });
});
