/**
 * TypeScript adapter over the Rust/WASM indicator core (rust/quant-core).
 * Mirrors the public API of ./indicators.ts; see that file for formulas.
 */
import type { OHLCV } from '@/types/common';
import {
    calculate_adx as wasmAdx,
    calculate_atr as wasmAtr,
    calculate_bollinger_bands as wasmBollinger,
    calculate_ema as wasmEma,
    calculate_hurst as wasmHurst,
    calculate_macd as wasmMacd,
    calculate_obv as wasmObv,
    calculate_ofi as wasmOfi,
    calculate_rsi as wasmRsi,
    calculate_sma as wasmSma,
    calculate_vwap as wasmVwap,
} from '@/wasm/quant-core/quant_core';

import type {
    BollingerBandsValue,
    IndicatorValue,
    MACDValue,
    OFIResult,
} from './indicators';

export interface WasmTrade {
    quantity: number | string;
    isBuyerMaker: boolean;
}

export function wasmCalculateVWAP(data: OHLCV[]): IndicatorValue[] {
    return wasmVwap(data as unknown as object[]) as IndicatorValue[];
}

export function wasmCalculateSMA(data: OHLCV[], period: number): IndicatorValue[] {
    return wasmSma(data as unknown as object[], period) as IndicatorValue[];
}

export function wasmCalculateEMA(data: OHLCV[], period: number): IndicatorValue[] {
    return wasmEma(data as unknown as object[], period) as IndicatorValue[];
}

export function wasmCalculateRSI(data: OHLCV[], period: number): IndicatorValue[] {
    return wasmRsi(data as unknown as object[], period) as IndicatorValue[];
}

export function wasmCalculateBollingerBands(
    data: OHLCV[],
    period: number,
    stdDev: number,
): BollingerBandsValue[] {
    return wasmBollinger(data as unknown as object[], period, stdDev) as BollingerBandsValue[];
}

export function wasmCalculateMACD(
    data: OHLCV[],
    fastPeriod: number,
    slowPeriod: number,
    signalPeriod: number,
): MACDValue[] {
    return wasmMacd(data as unknown as object[], fastPeriod, slowPeriod, signalPeriod) as MACDValue[];
}

export function wasmCalculateATR(data: OHLCV[], period: number): IndicatorValue[] {
    return wasmAtr(data as unknown as object[], period) as IndicatorValue[];
}

export function wasmCalculateOFI(trades: WasmTrade[]): OFIResult {
    // Preserve the TS reference behavior of warning on unparseable quantities
    // (the Rust core silently skips them).
    for (const trade of trades) {
        const qty = typeof trade.quantity === 'string' ? parseFloat(trade.quantity) : trade.quantity;
        if (typeof qty !== 'number' || isNaN(qty) || !isFinite(qty)) {
            console.warn('Invalid trade quantity:', trade.quantity);
        }
    }
    return wasmOfi(trades as unknown as object[]) as OFIResult;
}

export function wasmCalculateOBV(data: OHLCV[]): IndicatorValue[] {
    return wasmObv(data as unknown as object[]) as IndicatorValue[];
}

export function wasmCalculateADX(data: OHLCV[], period: number): IndicatorValue[] {
    return wasmAdx(data as unknown as object[], period) as IndicatorValue[];
}

export function wasmCalculateHurst(data: OHLCV[]): number {
    return wasmHurst(data as unknown as object[]) as number;
}
