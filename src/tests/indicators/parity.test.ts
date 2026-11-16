// @vitest-environment node

import { describe, it, expect } from 'vitest';
import type { OHLCV } from '@/types/common';
import * as wasm from '@/utils/indicators';
import * as reference from '@/utils/indicators-reference';

// Deterministic pseudo-random walk so parity is reproducible.
function makeCandles(n: number, seed = 42): OHLCV[] {
    let state = seed;
    const rand = () => {
        state = (state * 1103515245 + 12345) % 2147483648;
        return state / 2147483648;
    };
    const candles: OHLCV[] = [];
    let price = 100;
    for (let i = 0; i < n; i++) {
        const open = price;
        const close = open * (1 + (rand() - 0.5) * 0.04);
        const high = Math.max(open, close) * (1 + rand() * 0.01);
        const low = Math.min(open, close) * (1 - rand() * 0.01);
        candles.push({
            time: 1700000000 + i * 60,
            open,
            high,
            low,
            close,
            volume: 1000 + rand() * 5000,
        });
        price = close;
    }
    return candles;
}

const EPS = 1e-9;

function expectClose(a: number, b: number) {
    expect(Math.abs(a - b)).toBeLessThanOrEqual(EPS * Math.max(1, Math.abs(b)));
}

function expectSeriesClose(a: { time: number; value: number }[], b: { time: number; value: number }[]) {
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) {
        expect(a[i]!.time).toBe(b[i]!.time);
        expectClose(a[i]!.value, b[i]!.value);
    }
}

describe('WASM/reference parity', () => {
    const data = makeCandles(300);

    it('SMA matches', () => {
        expectSeriesClose(wasm.calculateSMA(data, 20), reference.calculateSMA(data, 20));
    });

    it('EMA matches', () => {
        expectSeriesClose(wasm.calculateEMA(data, 20), reference.calculateEMA(data, 20));
    });

    it('RSI matches', () => {
        expectSeriesClose(wasm.calculateRSI(data, 14), reference.calculateRSI(data, 14));
    });

    it('MACD matches', () => {
        const w = wasm.calculateMACD(data, 12, 26, 9);
        const r = reference.calculateMACD(data, 12, 26, 9);
        expect(w.length).toBe(r.length);
        for (let i = 0; i < w.length; i++) {
            expect(w[i]!.time).toBe(r[i]!.time);
            expectClose(w[i]!.macd, r[i]!.macd);
            expectClose(w[i]!.signal, r[i]!.signal);
            expectClose(w[i]!.histogram, r[i]!.histogram);
        }
    });

    it('ATR matches', () => {
        expectSeriesClose(wasm.calculateATR(data, 14), reference.calculateATR(data, 14));
    });

    it('ADX matches', () => {
        expectSeriesClose(wasm.calculateADX(data, 14), reference.calculateADX(data, 14));
    });

    it('OBV matches', () => {
        expectSeriesClose(wasm.calculateOBV(data), reference.calculateOBV(data));
    });

    it('VWAP matches', () => {
        expectSeriesClose(wasm.calculateVWAP(data), reference.calculateVWAP(data));
    });

    it('Bollinger Bands matches', () => {
        const w = wasm.calculateBollingerBands(data, 20, 2);
        const r = reference.calculateBollingerBands(data, 20, 2);
        expect(w.length).toBe(r.length);
        for (let i = 0; i < w.length; i++) {
            expect(w[i]!.time).toBe(r[i]!.time);
            expectClose(w[i]!.upper, r[i]!.upper);
            expectClose(w[i]!.middle, r[i]!.middle);
            expectClose(w[i]!.lower, r[i]!.lower);
        }
    });

    it('OFI matches', () => {
        const trades = Array.from({ length: 500 }, (_, i) => ({
            quantity: i % 3 === 0 ? `${(i % 17) + 0.5}` : (i % 17) + 0.5,
            isBuyerMaker: i % 2 === 0,
        }));
        const w = wasm.calculateOFI(trades);
        const r = reference.calculateOFI(trades);
        expectClose(w.buyVolume, r.buyVolume);
        expectClose(w.sellVolume, r.sellVolume);
        expectClose(w.netVolume, r.netVolume);
        expectClose(w.imbalanceRatio, r.imbalanceRatio);
    });

    it('Hurst matches', () => {
        expectClose(wasm.calculateHurst(data), reference.calculateHurst(data));
    });
});
