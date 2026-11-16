/**
 * Technical Analysis Indicators
 * Implementations live in the Rust/WASM core (rust/quant-core, see
 * src/wasm/quant-core). The original TypeScript reference implementation is
 * preserved in ./indicators-reference.ts for parity testing.
 */

import type { OHLCV } from '@/types/common';
import {
    wasmCalculateADX,
    wasmCalculateATR,
    wasmCalculateBollingerBands,
    wasmCalculateEMA,
    wasmCalculateHurst,
    wasmCalculateMACD,
    wasmCalculateOBV,
    wasmCalculateOFI,
    wasmCalculateRSI,
    wasmCalculateSMA,
    wasmCalculateVWAP,
    type WasmTrade,
} from './indicators-wasm';

/**
 * Technical indicator result types
 */
export interface IndicatorValue {
    time: number;
    value: number;
}

export interface BollingerBandsValue {
    time: number;
    upper: number;
    middle: number;
    lower: number;
}

export interface MACDValue {
    time: number;
    macd: number;
    signal: number;
    histogram: number;
}

export interface OFIResult {
    buyVolume: number;
    sellVolume: number;
    netVolume: number;
    imbalanceRatio: number; // -1 to 1
}

/**
 * Calculate VWAP (Volume Weighted Average Price)
 */
export function calculateVWAP(data: OHLCV[]): IndicatorValue[] {
    return wasmCalculateVWAP(data);
}

/**
 * Calculate Simple Moving Average
 */
export function calculateSMA(data: OHLCV[], period: number = 20): IndicatorValue[] {
    return wasmCalculateSMA(data, period);
}

/**
 * Calculate Exponential Moving Average
 */
export function calculateEMA(data: OHLCV[], period: number = 12): IndicatorValue[] {
    return wasmCalculateEMA(data, period);
}

/**
 * Calculate Relative Strength Index
 */
export function calculateRSI(data: OHLCV[], period: number = 14): IndicatorValue[] {
    return wasmCalculateRSI(data, period);
}

/**
 * Calculate Bollinger Bands
 */
export function calculateBollingerBands(
    data: OHLCV[],
    period: number = 20,
    stdDev: number = 2
): BollingerBandsValue[] {
    return wasmCalculateBollingerBands(data, period, stdDev);
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 */
export function calculateMACD(
    data: OHLCV[],
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9
): MACDValue[] {
    return wasmCalculateMACD(data, fastPeriod, slowPeriod, signalPeriod);
}

/**
 * Calculate Average True Range
 */
export function calculateATR(data: OHLCV[], period: number = 14): IndicatorValue[] {
    return wasmCalculateATR(data, period);
}

/**
 * Calculate Order Flow Imbalance
 */
export function calculateOFI(trades: WasmTrade[]): OFIResult {
    return wasmCalculateOFI(trades);
}

/**
 * Calculate On-Balance Volume
 */
export function calculateOBV(data: OHLCV[]): IndicatorValue[] {
    return wasmCalculateOBV(data);
}

/**
 * Calculate Average Directional Index
 */
export function calculateADX(data: OHLCV[], period: number = 14): IndicatorValue[] {
    return wasmCalculateADX(data, period);
}

/**
 * Calculate Hurst Exponent (simplified R/S analysis)
 */
export function calculateHurst(data: OHLCV[]): number {
    return wasmCalculateHurst(data);
}
