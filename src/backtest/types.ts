import type { OHLCV } from '@/types/common';

export const BACKTEST_CONTRACT_VERSION = 'backtest-v1' as const;

export type BacktestCandle = OHLCV;
export type BacktestExitReason = 'SIGNAL' | 'END_OF_DATA';

export interface BacktestConfig {
    initialCapital: number;
    fastPeriod: number;
    slowPeriod: number;
    feeBps: number;
    slippageBps: number;
}

export interface BacktestDataset {
    id: string;
    name: string;
    symbol: string;
    interval: '1m';
    source: 'SYNTHETIC_FIXTURE';
    checksum: string;
    candleCount: number;
    startTime: number;
    endTime: number;
}

export interface BacktestTrade {
    id: string;
    side: 'LONG';
    entryTime: number;
    exitTime: number;
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    entryFee: number;
    exitFee: number;
    grossPnl: number;
    netPnl: number;
    returnPct: number;
    barsHeld: number;
    exitReason: BacktestExitReason;
}

export interface BacktestEquityPoint {
    time: number;
    equity: number;
    drawdownPct: number;
    positionQuantity: number;
}

export interface BacktestMetrics {
    initialCapital: number;
    finalEquity: number;
    totalReturnPct: number;
    maxDrawdownPct: number;
    totalTrades: number;
    winRatePct: number;
    profitFactor: number | null;
    sharpeRatio: number;
    totalFees: number;
    exposurePct: number;
}

export interface BacktestDiagnostics {
    deterministic: true;
    executionTiming: 'NEXT_BAR_OPEN';
    priceModel: 'MARKET_WITH_BPS_COSTS';
    warnings: string[];
}

export interface BacktestResult {
    contractVersion: typeof BACKTEST_CONTRACT_VERSION;
    engine: 'TYPESCRIPT_REFERENCE';
    strategy: 'SMA_CROSS_LONG_FLAT';
    dataset: BacktestDataset;
    config: BacktestConfig;
    metrics: BacktestMetrics;
    trades: BacktestTrade[];
    equityCurve: BacktestEquityPoint[];
    diagnostics: BacktestDiagnostics;
}

export interface BacktestFixture {
    dataset: BacktestDataset;
    candles: BacktestCandle[];
}
