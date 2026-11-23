/**
 * Backtest engine backed by the Rust/WASM core (rust/quant-core).
 * Mirrors the reference implementation in ./engine-reference.ts; the
 * `backtest-v1` contract is shared with the TypeScript reference engine.
 */
import {
    run_sma_cross_backtest,
    validate_backtest_input_js,
} from '@/wasm/quant-core/quant_core';
import type {
    BacktestCandle,
    BacktestConfig,
    BacktestDataset,
    BacktestResult,
} from '@/backtest/types';

export const validateBacktestInput = (
    candles: BacktestCandle[],
    config: BacktestConfig,
    dataset: BacktestDataset,
): void => {
    validate_backtest_input_js(candles, config, dataset);
};

export const runSmaCrossBacktest = (
    candles: BacktestCandle[],
    dataset: BacktestDataset,
    config: BacktestConfig,
): BacktestResult => {
    return run_sma_cross_backtest(candles, dataset, config) as BacktestResult;
};
