import { describe, expect, it } from 'vitest';
import type { OHLCV } from '@/types/common';
import {
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
