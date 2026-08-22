import type {
    CandlestickData,
    HistogramData,
    LineData,
    UTCTimestamp,
} from 'lightweight-charts';
import type { OHLCV } from '@/types/common';

export interface VolumeColors {
    up: string;
    down: string;
}

const DEFAULT_VOLUME_COLORS: VolumeColors = { up: '#22c55e', down: '#ef4444' };

const toUnixSecond = (time: number): UTCTimestamp => Math.floor(time) as UTCTimestamp;

const isFiniteRow = (row: OHLCV): boolean =>
    [row.time, row.open, row.high, row.low, row.close, row.volume].every((value) =>
        Number.isFinite(value),
    );

export const toCandlestickData = (candles: readonly OHLCV[]): CandlestickData<UTCTimestamp>[] =>
    candles.filter(isFiniteRow).map((row) => ({
        time: toUnixSecond(row.time),
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
    }));

export const toVolumeHistogramData = (
    candles: readonly OHLCV[],
    colors: VolumeColors = DEFAULT_VOLUME_COLORS,
): HistogramData<UTCTimestamp>[] =>
    candles.filter(isFiniteRow).map((row) => ({
        time: toUnixSecond(row.time),
        value: row.volume,
        color: row.close >= row.open ? colors.up : colors.down,
    }));

export const toLineData = (
    points: readonly { time: number; value: number }[],
): LineData<UTCTimestamp>[] =>
    points
        .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.value))
        .map((point) => ({ time: toUnixSecond(point.time), value: point.value }));

export type ChartAction =
    | {
          type: 'update';
          candle: CandlestickData<UTCTimestamp>;
          volume: HistogramData<UTCTimestamp>;
      }
    | { type: 'reload' };

const sameCandle = (a: OHLCV, b: OHLCV): boolean =>
    a.time === b.time &&
    a.open === b.open &&
    a.high === b.high &&
    a.low === b.low &&
    a.close === b.close &&
    a.volume === b.volume;

/**
 * Decides between an incremental series.update() and a full setData() reload.
 * An update is valid only when the two series share an identical body and at
 * most the trailing candle changed in place or exactly one candle appended.
 * Any reshaped history (backfill, window shift, symbol change) forces a reload.
 */
export const nextChartAction = (
    previous: readonly OHLCV[],
    next: readonly OHLCV[],
): ChartAction => {
    if (previous.length === 0 || next.length === 0) return { type: 'reload' };

    const sameLength = next.length === previous.length;
    const appendedOne = next.length === previous.length + 1;
    if (!sameLength && !appendedOne) return { type: 'reload' };

    // Equal length: only the trailing candle may differ. Append: every
    // previous row must match and the new row carries a fresh timestamp.
    const stableRows = sameLength ? previous.length - 1 : previous.length;
    for (let i = 0; i < stableRows; i += 1) {
        if (!sameCandle(previous[i]!, next[i]!)) return { type: 'reload' };
    }
    if (appendedOne && next[next.length - 1]!.time === previous[previous.length - 1]!.time) {
        return { type: 'reload' };
    }

    const last = next[next.length - 1]!;
    if (!isFiniteRow(last)) return { type: 'reload' };

    return {
        type: 'update',
        candle: toCandlestickData([last])[0]!,
        volume: toVolumeHistogramData([last])[0]!,
    };
};
