import { describe, expect, it } from 'vitest';
import type { OHLCV } from '@/types/common';
import {
    getPriceFormatConfig,
    nextChartAction,
    toCandlestickData,
    toLineData,
    toVolumeHistogramData,
} from '@/utils/chartDataMapping';

const candle = (time: number, close: number, open = close - 1): OHLCV => ({
    time,
    open,
    high: close + 2,
    low: open - 2,
    close,
    volume: 10 + close,
});

describe('toCandlestickData', () => {
    it('maps OHLCV rows to whole-second candlestick data', () => {
        const rows = [candle(1700000000.5, 100)];
        const result = toCandlestickData(rows);
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ time: 1700000000, open: 99, high: 102, low: 97, close: 100 });
    });

    it('drops rows with non-finite fields', () => {
        const rows = [candle(1, 100), { time: 2, open: NaN, high: 3, low: 1, close: 2, volume: 5 }];
        expect(toCandlestickData(rows)).toHaveLength(1);
    });
});

describe('toVolumeHistogramData', () => {
    it('colors by candle direction and floors the timestamp', () => {
        const rows = [candle(1700000000.9, 100), candle(1700000060, 90, 95)];
        const result = toVolumeHistogramData(rows);
        expect(result[0]!.color).toBe('#22c55e');
        expect(result[1]!.color).toBe('#ef4444');
        expect(result[0]!.time).toBe(1700000000);
        expect(result[1]!.value).toBe(100);
    });

    it('accepts custom colors', () => {
        const result = toVolumeHistogramData([candle(1, 100)], { up: '#aaa', down: '#bbb' });
        expect(result[0]!.color).toBe('#aaa');
    });
});

describe('toLineData', () => {
    it('maps points and drops non-finite values', () => {
        const result = toLineData([
            { time: 1700000000.5, value: 1 },
            { time: 1700000060, value: NaN },
            { time: 1700000120, value: 3 },
        ]);
        expect(result).toEqual([
            { time: 1700000000, value: 1 },
            { time: 1700000120, value: 3 },
        ]);
    });
});

describe('nextChartAction', () => {
    it('returns reload when either side is empty', () => {
        expect(nextChartAction([], [candle(1, 100)])).toEqual({ type: 'reload' });
        expect(nextChartAction([candle(1, 100)], [])).toEqual({ type: 'reload' });
    });

    it('returns update when only the last candle changed in place', () => {
        const previous = [candle(1, 100), candle(60, 200)];
        const next = [candle(1, 100), candle(60, 210)];
        const action = nextChartAction(previous, next);
        expect(action.type).toBe('update');
        if (action.type === 'update') {
            expect(action.candle.close).toBe(210);
            expect(action.volume.value).toBe(220);
        }
    });

    it('returns update when exactly one candle is appended', () => {
        const previous = [candle(1, 100)];
        const next = [candle(1, 100), candle(60, 200)];
        expect(nextChartAction(previous, next).type).toBe('update');
    });

    it('returns reload when history is reshaped (different symbol or backfill)', () => {
        const previous = [candle(1, 100), candle(60, 200), candle(120, 300)];
        const next = [candle(500, 100), candle(560, 200), candle(620, 300)];
        expect(nextChartAction(previous, next).type).toBe('reload');
    });

    it('returns reload when the series shrinks', () => {
        const previous = [candle(1, 100), candle(60, 200), candle(120, 300)];
        expect(nextChartAction(previous, [candle(120, 300)])).toEqual({ type: 'reload' });
    });

    it('returns reload when an interior candle changes', () => {
        const previous = [candle(1, 100), candle(60, 200)];
        const next = [candle(1, 150), candle(60, 200)];
        expect(nextChartAction(previous, next).type).toBe('reload');
    });
});

describe('getPriceFormatConfig', () => {
    it('returns default 2-digit precision for undefined, NaN, or non-positive numbers', () => {
        expect(getPriceFormatConfig(undefined)).toEqual({ type: 'price', precision: 2, minMove: 0.01 });
        expect(getPriceFormatConfig(NaN)).toEqual({ type: 'price', precision: 2, minMove: 0.01 });
        expect(getPriceFormatConfig(0)).toEqual({ type: 'price', precision: 2, minMove: 0.01 });
        expect(getPriceFormatConfig(-10)).toEqual({ type: 'price', precision: 2, minMove: 0.01 });
    });

    it('returns 8-digit precision for sub-0.0001 micro assets (e.g. SHIB, PEPE)', () => {
        expect(getPriceFormatConfig(0.000025)).toEqual({ type: 'price', precision: 8, minMove: 0.00000001 });
    });

    it('returns 6-digit precision for sub-0.01 assets', () => {
        expect(getPriceFormatConfig(0.005)).toEqual({ type: 'price', precision: 6, minMove: 0.000001 });
    });

    it('returns 4-digit precision for sub-1 dollar assets (e.g. DOGE, ADA, XRP)', () => {
        expect(getPriceFormatConfig(0.1234)).toEqual({ type: 'price', precision: 4, minMove: 0.0001 });
        expect(getPriceFormatConfig(0.35)).toEqual({ type: 'price', precision: 4, minMove: 0.0001 });
    });

    it('returns 3-digit precision for single-digit assets (< 10)', () => {
        expect(getPriceFormatConfig(3.456)).toEqual({ type: 'price', precision: 3, minMove: 0.001 });
    });

    it('returns 2-digit precision for standard assets >= 10 (e.g. SOL, ETH, BTC)', () => {
        expect(getPriceFormatConfig(150.25)).toEqual({ type: 'price', precision: 2, minMove: 0.01 });
        expect(getPriceFormatConfig(3500)).toEqual({ type: 'price', precision: 2, minMove: 0.01 });
        expect(getPriceFormatConfig(65000)).toEqual({ type: 'price', precision: 2, minMove: 0.01 });
    });
});
