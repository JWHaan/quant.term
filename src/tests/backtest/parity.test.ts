import { describe, expect, it } from 'vitest';
import { runSmaCrossBacktest as runReference } from '@/backtest/engine-reference';
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

// Deterministic pseudo-random closes to exercise multiple cross signals.
const pseudoRandomCloses = (count: number): number[] => {
    const closes: number[] = [];
    let price = 100;
    let seed = 42;
    for (let i = 0; i < count; i += 1) {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        price += ((seed / 2147483648) - 0.5) * 4;
        closes.push(Math.max(1, price));
    }
    return closes;
};

const candlesFromCloses = (closes: number[]): BacktestCandle[] => (
    closes.map((close, index) => ({
        time: 1_700_000_000 + (index * 60),
        open: close,
        high: close + 1,
        low: close - 1,
        close,
        volume: 10,
    }))
);

const stripEngine = (result: ReturnType<typeof runSmaCrossBacktest>) => {
    const { engine: _engine, ...rest } = result;
    return rest;
};

describe('WASM engine parity with TS reference', () => {
    it('matches the reference on the synthetic fixture', () => {
        const fixture = createSyntheticBtcFixture();
        const wasm = runSmaCrossBacktest(fixture.candles, fixture.dataset, defaultConfig);
        const reference = runReference(fixture.candles, fixture.dataset, defaultConfig);

        expect(wasm.engine).toBe('RUST_WASM');
        expect(reference.engine).toBe('TYPESCRIPT_REFERENCE');
        expect(stripEngine(wasm)).toEqual(stripEngine(reference));
    });

    it('matches the reference on pseudo-random data', () => {
        const candles = candlesFromCloses(pseudoRandomCloses(500));
        const wasm = runSmaCrossBacktest(candles, testDataset, defaultConfig);
        const reference = runReference(candles, testDataset, defaultConfig);

        expect(stripEngine(wasm)).toEqual(stripEngine(reference));
    });

    it('matches the reference on fee/slippage edge configs', () => {
        const candles = candlesFromCloses(pseudoRandomCloses(200));
        for (const config of [
            { ...defaultConfig, feeBps: 0, slippageBps: 0 },
            { ...defaultConfig, feeBps: 1_000, slippageBps: 1_000 },
            { ...defaultConfig, initialCapital: 0.001, fastPeriod: 2, slowPeriod: 3 },
        ]) {
            const wasm = runSmaCrossBacktest(candles, testDataset, config);
            const reference = runReference(candles, testDataset, config);
            expect(stripEngine(wasm)).toEqual(stripEngine(reference));
        }
    });

    it('rejects the same invalid inputs with the same messages', () => {
        const candles = candlesFromCloses(pseudoRandomCloses(50));
        const badConfigs: Partial<BacktestConfig>[] = [
            { initialCapital: 0 },
            { initialCapital: Number.NaN },
            { fastPeriod: 1 },
            { fastPeriod: 2.5 },
            { slowPeriod: 2 },
            { feeBps: -1 },
            { feeBps: 1_001 },
            { slippageBps: Number.POSITIVE_INFINITY },
        ];
        for (const patch of badConfigs) {
            const config = { ...defaultConfig, ...patch };
            let wasmError: string | null = null;
            let refError: string | null = null;
            try {
                runSmaCrossBacktest(candles, testDataset, config);
            } catch (error) {
                wasmError = (error as Error).message;
            }
            try {
                runReference(candles, testDataset, config);
            } catch (error) {
                refError = (error as Error).message;
            }
            expect(wasmError).toBe(refError);
            expect(wasmError).not.toBeNull();
        }

        const badDataset = { ...testDataset, intervalSeconds: 0 };
        expect(() => validateBacktestInput(candles, defaultConfig, badDataset)).toThrow(
            'Interval seconds must be finite and positive',
        );
    });

    it('does not mutate inputs', () => {
        const fixture = createSyntheticBtcFixture();
        const candlesBefore = structuredClone(fixture.candles);
        const configBefore = structuredClone(defaultConfig);
        runSmaCrossBacktest(fixture.candles, fixture.dataset, defaultConfig);
        expect(fixture.candles).toEqual(candlesBefore);
        expect(defaultConfig).toEqual(configBefore);
    });
});
