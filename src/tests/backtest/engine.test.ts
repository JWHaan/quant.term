import { describe, expect, it } from 'vitest';
import { runSmaCrossBacktest, validateBacktestInput } from '@/backtest/engine';
import { createSyntheticBtcFixture } from '@/backtest/fixture';
import type { BacktestCandle, BacktestConfig, BacktestDataset } from '@/backtest/types';

const defaultConfig: BacktestConfig = {
    initialCapital: 10_000,
    fastPeriod: 12,
    slowPeriod: 36,
    feeBps: 10,
    slippageBps: 5,
};

const testDataset: BacktestDataset = {
    id: 'test',
    name: 'Test fixture',
    symbol: 'BTCUSDT',
    interval: '1m',
    source: 'SYNTHETIC_FIXTURE',
    checksum: 'test-checksum',
    candleCount: 0,
    startTime: 0,
    endTime: 0,
    intervalSeconds: 60,
    fetchedAt: 0,
};

const candlesFromCloses = (closes: number[], opens = closes): BacktestCandle[] => (
    closes.map((close, index) => {
        const open = opens[index] ?? close;
        return {
            time: 1_700_000_000 + (index * 60),
            open,
            high: Math.max(open, close) + 1,
            low: Math.min(open, close) - 1,
            close,
            volume: 10,
        };
    })
);

describe('deterministic SMA crossover backtester', () => {
    it('replays the bundled fixture reproducibly', () => {
        const fixture = createSyntheticBtcFixture();

        const first = runSmaCrossBacktest(fixture.candles, fixture.dataset, defaultConfig);
        const second = runSmaCrossBacktest(fixture.candles, fixture.dataset, defaultConfig);

        expect(second).toEqual(first);
        expect(first.metrics.totalTrades).toBeGreaterThan(0);
        expect(first.equityCurve).toHaveLength(fixture.candles.length);
        expect(first.dataset.checksum).toMatch(/^fnv1a-[0-9a-f]{8}$/);
        // Golden values are shared with the native C++20 correctness test.
        expect(first.metrics.finalEquity).toBeCloseTo(10_692.208640, 6);
        expect(first.metrics.totalReturnPct).toBeCloseTo(6.922086, 6);
        expect(first.metrics.maxDrawdownPct).toBeCloseTo(0.917863, 6);
        expect(first.metrics.totalTrades).toBe(2);
        expect(first.metrics.totalFees).toBeCloseTo(41.248917, 6);
    });

    it('executes a crossover on the next candle open', () => {
        const candles = candlesFromCloses(
            [10, 9, 8, 9, 12, 14, 13, 10, 8],
            [10, 10, 9, 8, 9, 20, 14, 13, 10],
        );
        const result = runSmaCrossBacktest(candles, testDataset, {
            ...defaultConfig,
            fastPeriod: 2,
            slowPeriod: 3,
            feeBps: 0,
            slippageBps: 0,
        });

        expect(result.trades[0]?.entryTime).toBe(candles[5]?.time);
        expect(result.trades[0]?.entryPrice).toBe(20);
    });

    it('does not let future candles alter an already generated entry', () => {
        const prefix = candlesFromCloses(
            [10, 9, 8, 9, 12, 14],
            [10, 10, 9, 8, 9, 20],
        );
        const calmFuture = candlesFromCloses([13, 12, 11, 10, 9]).map((candle, index) => ({
            ...candle,
            time: prefix.at(-1)!.time + ((index + 1) * 60),
        }));
        const extremeFuture = calmFuture.map((candle, index) => ({
            ...candle,
            open: candle.open * (index + 2),
            high: candle.high * (index + 2),
            low: candle.low,
            close: candle.close * (index + 2),
        }));
        const config = { ...defaultConfig, fastPeriod: 2, slowPeriod: 3 };

        const calm = runSmaCrossBacktest([...prefix, ...calmFuture], testDataset, config);
        const extreme = runSmaCrossBacktest([...prefix, ...extremeFuture], testDataset, config);

        expect(extreme.trades[0]?.entryTime).toBe(calm.trades[0]?.entryTime);
        expect(extreme.trades[0]?.entryPrice).toBe(calm.trades[0]?.entryPrice);
    });

    it('reduces returns when fees and slippage are enabled', () => {
        const fixture = createSyntheticBtcFixture();
        const free = runSmaCrossBacktest(fixture.candles, fixture.dataset, {
            ...defaultConfig,
            feeBps: 0,
            slippageBps: 0,
        });
        const costly = runSmaCrossBacktest(fixture.candles, fixture.dataset, defaultConfig);

        expect(costly.metrics.finalEquity).toBeLessThan(free.metrics.finalEquity);
        expect(costly.metrics.totalFees).toBeGreaterThan(0);
    });

    it('forces an open position closed at the end of the dataset', () => {
        const candles = candlesFromCloses([10, 9, 8, 9, 12, 14, 16]);
        const result = runSmaCrossBacktest(candles, testDataset, {
            ...defaultConfig,
            fastPeriod: 2,
            slowPeriod: 3,
        });

        expect(result.trades.at(-1)?.exitReason).toBe('END_OF_DATA');
        expect(result.equityCurve.at(-1)?.positionQuantity).toBe(0);
    });

    it('does not mutate the input candles or config', () => {
        const fixture = createSyntheticBtcFixture();
        const candlesBefore = structuredClone(fixture.candles);
        const configBefore = structuredClone(defaultConfig);

        runSmaCrossBacktest(fixture.candles, fixture.dataset, defaultConfig);

        expect(fixture.candles).toEqual(candlesBefore);
        expect(defaultConfig).toEqual(configBefore);
    });

    it.each([
        [{ ...defaultConfig, initialCapital: 0 }, 'Initial capital'],
        [{ ...defaultConfig, fastPeriod: 1 }, 'Fast period'],
        [{ ...defaultConfig, fastPeriod: 36 }, 'Slow period'],
        [{ ...defaultConfig, feeBps: -1 }, 'Fee'],
        [{ ...defaultConfig, slippageBps: 1_001 }, 'Slippage'],
    ])('rejects invalid configuration %#', (config, message) => {
        const fixture = createSyntheticBtcFixture();
        expect(() => validateBacktestInput(fixture.candles, config, testDataset)).toThrow(message);
    });

    it('rejects invalid dataset intervalSeconds', () => {
        const fixture = createSyntheticBtcFixture();
        expect(() => validateBacktestInput(
            fixture.candles,
            defaultConfig,
            { ...testDataset, intervalSeconds: 0 },
        )).toThrow('Interval seconds must be finite and positive');
        expect(() => validateBacktestInput(
            fixture.candles,
            defaultConfig,
            { ...testDataset, intervalSeconds: -60 },
        )).toThrow('Interval seconds must be finite and positive');
        expect(() => validateBacktestInput(
            fixture.candles,
            defaultConfig,
            { ...testDataset, intervalSeconds: Number.NaN },
        )).toThrow('Interval seconds must be finite and positive');
        expect(() => validateBacktestInput(
            fixture.candles,
            defaultConfig,
            { ...testDataset, intervalSeconds: Number.POSITIVE_INFINITY },
        )).toThrow('Interval seconds must be finite and positive');
    });

    it('accepts a valid dataset intervalSeconds', () => {
        const fixture = createSyntheticBtcFixture();
        expect(() => validateBacktestInput(fixture.candles, defaultConfig, testDataset)).not.toThrow();
    });

    it('rejects out-of-order timestamps', () => {
        const fixture = createSyntheticBtcFixture();
        const invalid = fixture.candles.map((candle) => ({ ...candle }));
        invalid[20] = { ...invalid[20]!, time: invalid[19]!.time };

        expect(() => validateBacktestInput(invalid, defaultConfig, testDataset)).toThrow(
            'strictly increasing',
        );
    });

    it('rejects inconsistent OHLC bounds', () => {
        const fixture = createSyntheticBtcFixture();
        const invalid = fixture.candles.map((candle) => ({ ...candle }));
        invalid[20] = { ...invalid[20]!, high: invalid[20]!.close - 1 };

        expect(() => validateBacktestInput(invalid, defaultConfig, testDataset)).toThrow(
            'inconsistent OHLC bounds',
        );
    });
});

describe('interval-aware metrics', () => {
    it('keeps 1-minute golden values when intervalSeconds is 60', () => {
        const fixture = createSyntheticBtcFixture();
        const result = runSmaCrossBacktest(fixture.candles, fixture.dataset, defaultConfig);
        expect(result.metrics.finalEquity).toBeCloseTo(10_692.208640, 6);
    });

    it('derives Sharpe annualization from dataset.intervalSeconds', () => {
        const fixture = createSyntheticBtcFixture();
        const oneMinute = runSmaCrossBacktest(fixture.candles, fixture.dataset, defaultConfig);
        const hourlyDataset = { ...fixture.dataset, id: 'hourly-equivalent', intervalSeconds: 3_600 };
        const hourly = runSmaCrossBacktest(fixture.candles, hourlyDataset, defaultConfig);
        expect(hourly.metrics.sharpeRatio).toBeCloseTo(oneMinute.metrics.sharpeRatio * Math.sqrt(1 / 60), 10);
    });

    it('emits the synthetic disclaimer only for SYNTHETIC_FIXTURE datasets', () => {
        const fixture = createSyntheticBtcFixture();
        const binanceDataset = { ...fixture.dataset, id: 'binance-test', source: 'BINANCE_REST' as const, fetchedAt: 1_758_000_000_000 };

        const synthetic = runSmaCrossBacktest(fixture.candles, fixture.dataset, defaultConfig);
        const realData = runSmaCrossBacktest(fixture.candles, binanceDataset, defaultConfig);

        // SYNTHETIC_FIXTURE pins BOTH synthetic warnings and NO real-data caveat…
        expect(synthetic.diagnostics.warnings.some((w) => w.includes('Synthetic validation data'))).toBe(true);
        expect(synthetic.diagnostics.warnings.some((w) => w.includes('long/flat market orders'))).toBe(true);
        expect(synthetic.diagnostics.warnings.some((w) => w.includes('exchange outage'))).toBe(false);
        // …while BINANCE_REST swaps the disclaimer for the exchange-outage caveat.
        expect(realData.diagnostics.warnings.some((w) => w.includes('exchange outage'))).toBe(true);
        expect(realData.diagnostics.warnings.some((w) => w.includes('Synthetic validation data'))).toBe(false);
    });
});
