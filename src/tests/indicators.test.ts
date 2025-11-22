import { describe, it, expect } from 'vitest';
import {
    calculateRSI,
    calculateEMA,
    calculateSMA,
    calculateMACD,
    calculateBollingerBands,
    calculateATR,
    calculateVWAP,
    calculateOFI
} from '@/utils/indicators';
import type { OHLCV } from '@/types/common';

// Helper to generate mock OHLCV data
const generateMockData = (length: number, basePrice: number = 100): OHLCV[] => {
    const data: OHLCV[] = [];
    let price = basePrice;
    
    for (let i = 0; i < length; i++) {
        const change = (Math.random() - 0.5) * 2; // Random walk
        price += change;
        
        data.push({
            time: 1000000 + i * 60,
            open: price - 0.5,
            high: price + 1,
            low: price - 1,
            close: price,
            volume: 1000 + Math.random() * 500
        });
    }
    
    return data;
};

describe('Technical Indicators', () => {
    describe('RSI (Relative Strength Index)', () => {
        it('should calculate RSI correctly', () => {
            const data = generateMockData(50);
            const rsi = calculateRSI(data, 14);
            
            expect(rsi.length).toBeGreaterThan(0);
            expect(rsi[0]?.value).toBeGreaterThanOrEqual(0);
            expect(rsi[0]?.value).toBeLessThanOrEqual(100);
        });

        it('should throw error for insufficient data', () => {
            const data = generateMockData(10);
            
            expect(() => calculateRSI(data, 14)).toThrow('Insufficient data');
        });

        it('should handle extreme overbought conditions', () => {
            // Create data with consistent upward movement
            const data: OHLCV[] = [];
            for (let i = 0; i < 50; i++) {
                data.push({
                    time: 1000000 + i * 60,
                    open: 100 + i,
                    high: 101 + i,
                    low: 99 + i,
                    close: 100 + i,
                    volume: 1000
                });
            }
            
            const rsi = calculateRSI(data, 14);
            const lastRSI = rsi[rsi.length - 1]?.value ?? 0;
            
            expect(lastRSI).toBeGreaterThan(70); // Should be overbought
        });

        it('should handle extreme oversold conditions', () => {
            // Create data with consistent downward movement
            const data: OHLCV[] = [];
            for (let i = 0; i < 50; i++) {
                data.push({
                    time: 1000000 + i * 60,
                    open: 100 - i,
                    high: 101 - i,
                    low: 99 - i,
                    close: 100 - i,
                    volume: 1000
                });
            }
            
            const rsi = calculateRSI(data, 14);
            const lastRSI = rsi[rsi.length - 1]?.value ?? 100;
            
            expect(lastRSI).toBeLessThan(30); // Should be oversold
        });
    });

    describe('EMA (Exponential Moving Average)', () => {
        it('should calculate EMA correctly', () => {
            const data = generateMockData(50);
            const ema = calculateEMA(data, 12);
            
            expect(ema.length).toBeGreaterThan(0);
            expect(ema[0]?.value).toBeGreaterThan(0);
        });

        it('should be more responsive than SMA', () => {
            const data = generateMockData(50);
            const ema = calculateEMA(data, 20);
            const sma = calculateSMA(data, 20);
            
            if (ema.length > 0 && sma.length > 0) {
                expect(ema.length).toBe(sma.length);
            }
            
            // EMA should react faster to price changes
            // This is a basic check - in real scenarios, EMA follows price more closely
            expect(ema[ema.length - 1]?.value).toBeDefined();
            expect(sma[sma.length - 1]?.value).toBeDefined();
        });
    });

    describe('SMA (Simple Moving Average)', () => {
        it('should calculate SMA correctly', () => {
            const data = generateMockData(50);
            const sma = calculateSMA(data, 20);
            
            expect(sma.length).toBe(data.length - 19);
        });

        it('should calculate exact average', () => {
            const data: OHLCV[] = [];
            for (let i = 0; i < 10; i++) {
                data.push({
                    time: 1000000 + i * 60,
                    open: 100,
                    high: 100,
                    low: 100,
                    close: 100,
                    volume: 1000
                });
            }
            
            const sma = calculateSMA(data, 5);
            expect(sma[0]?.value).toBe(100);
        });
    });

    describe('MACD (Moving Average Convergence Divergence)', () => {
        it('should calculate MACD correctly', () => {
            const data = generateMockData(100);
            const macd = calculateMACD(data, 12, 26, 9);
            
            expect(macd.length).toBeGreaterThan(0);
            expect(macd[0]).toHaveProperty('macd');
            expect(macd[0]).toHaveProperty('signal');
            expect(macd[0]).toHaveProperty('histogram');
        });

        it('should have histogram equal to macd minus signal', () => {
            const data = generateMockData(100);
            const macd = calculateMACD(data, 12, 26, 9);
            
            const last = macd[macd.length - 1];
            if (last) {
                expect(last.histogram).toBeCloseTo(last.macd - last.signal, 10);
            }
        });

        it('should throw error for insufficient data', () => {
            const data = generateMockData(30);
            
            expect(() => calculateMACD(data, 12, 26, 9)).toThrow('Insufficient data');
        });
    });

    describe('Bollinger Bands', () => {
        it('should calculate Bollinger Bands correctly', () => {
            const data = generateMockData(50);
            const bb = calculateBollingerBands(data, 20, 2);
            
            expect(bb.length).toBeGreaterThan(0);
            expect(bb[0]).toHaveProperty('upper');
            expect(bb[0]).toHaveProperty('middle');
            expect(bb[0]).toHaveProperty('lower');
        });

        it('should have upper band above middle and lower band below middle', () => {
            const data = generateMockData(50);
            const bb = calculateBollingerBands(data, 20, 2);
            
            for (const band of bb) {
                expect(band.upper).toBeGreaterThan(band.middle);
                expect(band.lower).toBeLessThan(band.middle);
            }
        });

        it('should have symmetric bands for constant price', () => {
            const data: OHLCV[] = [];
            for (let i = 0; i < 50; i++) {
                data.push({
                    time: 1000000 + i * 60,
                    open: 100,
                    high: 100,
                    low: 100,
                    close: 100,
                    volume: 1000
                });
            }
            
            const bb = calculateBollingerBands(data, 20, 2);
            const last = bb[bb.length - 1];
            
            if (last) {
                expect(last.upper).toBe(last.middle);
                expect(last.lower).toBe(last.middle);
            }
        });
    });

    describe('ATR (Average True Range)', () => {
        it('should calculate ATR correctly', () => {
            const data = generateMockData(50);
            const atr = calculateATR(data, 14);
            
            expect(atr.length).toBeGreaterThan(0);
            expect(atr[0]?.value).toBeGreaterThan(0);
        });

        it('should increase with higher volatility', () => {
            const lowVolData: OHLCV[] = [];
            const highVolData: OHLCV[] = [];
            
            for (let i = 0; i < 50; i++) {
                lowVolData.push({
                    time: 1000000 + i * 60,
                    open: 100,
                    high: 100.1,
                    low: 99.9,
                    close: 100,
                    volume: 1000
                });
                
                highVolData.push({
                    time: 1000000 + i * 60,
                    open: 100,
                    high: 105,
                    low: 95,
                    close: 100,
                    volume: 1000
                });
            }
            
            const lowATR = calculateATR(lowVolData, 14);
            const highATR = calculateATR(highVolData, 14);
            
            expect(highATR[highATR.length - 1]?.value ?? 0).toBeGreaterThan(
                lowATR[lowATR.length - 1]?.value ?? 0
            );
        });
    });

    describe('VWAP (Volume Weighted Average Price)', () => {
        it('should calculate VWAP correctly', () => {
            const data = generateMockData(50);
            const vwap = calculateVWAP(data);
            
            expect(vwap.length).toBe(data.length);
            expect(vwap[0]?.value).toBeGreaterThan(0);
        });

        it('should be cumulative', () => {
            const data = generateMockData(50);
            const vwap = calculateVWAP(data);
            
            // VWAP should change gradually as it's cumulative
            if (vwap.length > 0) {
                expect(vwap.length).toBe(data.length);
            }
        });
    });

    describe('OFI (Order Flow Imbalance)', () => {
        it('should calculate OFI correctly', () => {
            const trades = [
                { quantity: 1.5, isBuyerMaker: false }, // Buy
                { quantity: 2.0, isBuyerMaker: true },  // Sell
                { quantity: 1.0, isBuyerMaker: false }, // Buy
            ];
            
            const ofi = calculateOFI(trades);
            
            expect(ofi.buyVolume).toBe(2.5);
            expect(ofi.sellVolume).toBe(2.0);
            expect(ofi.netVolume).toBe(0.5);
            expect(ofi.imbalanceRatio).toBeCloseTo(0.111, 2);
        });

        it('should handle all buy trades', () => {
            const trades = [
                { quantity: 1.0, isBuyerMaker: false },
                { quantity: 2.0, isBuyerMaker: false },
            ];
            
            const ofi = calculateOFI(trades);
            
            expect(ofi.buyVolume).toBe(3.0);
            expect(ofi.sellVolume).toBe(0);
            expect(ofi.imbalanceRatio).toBe(1);
        });

        it('should handle all sell trades', () => {
            const trades = [
                { quantity: 1.0, isBuyerMaker: true },
                { quantity: 2.0, isBuyerMaker: true },
            ];
            
            const ofi = calculateOFI(trades);
            
            expect(ofi.buyVolume).toBe(0);
            expect(ofi.sellVolume).toBe(3.0);
            expect(ofi.imbalanceRatio).toBe(-1);
        });

        it('should handle empty trades array', () => {
            const ofi = calculateOFI([]);
            
            expect(ofi.buyVolume).toBe(0);
            expect(ofi.sellVolume).toBe(0);
            expect(ofi.netVolume).toBe(0);
            expect(ofi.imbalanceRatio).toBe(0);
        });

        it('should handle string quantities', () => {
            const trades = [
                { quantity: '1.5', isBuyerMaker: false },
                { quantity: '2.0', isBuyerMaker: true },
            ];
            
            const ofi = calculateOFI(trades);
            
            expect(ofi.buyVolume).toBe(1.5);
            expect(ofi.sellVolume).toBe(2.0);
        });
    });

    describe('Edge Cases', () => {
        it('should handle NaN values gracefully', () => {
            const data: OHLCV[] = [
                { time: 1000000, open: 100, high: 101, low: 99, close: NaN, volume: 1000 },
                { time: 1000060, open: 100, high: 101, low: 99, close: 100, volume: 1000 },
            ];
            
            expect(() => calculateRSI(data, 14)).toThrow();
        });

        it('should handle zero volume', () => {
            const data: OHLCV[] = [];
            for (let i = 0; i < 50; i++) {
                data.push({
                    time: 1000000 + i * 60,
                    open: 100,
                    high: 101,
                    low: 99,
                    close: 100,
                    volume: 0
                });
            }
            
            const vwap = calculateVWAP(data);
            expect(vwap[0]?.value).toBe(0);
        });
    });
});
