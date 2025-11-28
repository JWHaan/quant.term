/**
 * Common utility types and interfaces
 */

/** Technical Indicator Names */
export type IndicatorType = 'RSI' | 'MACD' | 'BB' | 'EMA' | 'SMA' | 'VWAP' | 'ATR' | 'STOCH';

/** Timeframe/Interval */
export type Timeframe = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '6h' | '12h' | '1d' | '3d' | '1w' | '1M';

/** OHLCV Candlestick Data */
export interface OHLCV {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

/** Data Provenance - Track data quality and lineage */
export type FeedStatus = 'LIVE' | 'STALE' | 'REPLAY' | 'DISCONNECTED';

export interface DataProvenance {
    exchangeTimestamp: number;      // Exchange-reported timestamp (ms)
    receivedTimestamp: number;       // Client receive time (ms)
    sequenceNumber: number;          // Message sequence for gap detection
    latencyMs: number;               // receivedTimestamp - exchangeTimestamp
    isSuspectedGap: boolean;         // True if >100ms since last tick
    feedStatus: FeedStatus;          // Current feed health status
}

/** OHLCV with provenance tracking */
export interface ProvenanceOHLCV extends OHLCV {
    provenance: DataProvenance;
}

/** Latency distribution statistics */
export interface LatencyDistribution {
    p50: number;
    p95: number;
    p99: number;
    samples: number[];
    lastUpdated: number;
}

/** Technical Indicator Values */
export interface IndicatorValues {
    RSI?: number;
    MACD?: {
        macd: number;
        signal: number;
        histogram: number;
    };
    BB?: {
        upper: number;
        middle: number;
        lower: number;
    };
    EMA?: number;
    SMA?: number;
    VWAP?: number;
    ATR?: number;
    STOCH?: {
        k: number;
        d: number;
    };
}

/** Quant Signal Strength */
export type SignalStrength = 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';

/** Quant Signal */
export interface QuantSignal {
    symbol: string;
    strength: SignalStrength;
    score: number; // -100 to +100
    indicators: IndicatorValues;
    timestamp: number;
    confidence: number; // 0-100
    reasons: string[];
}

/** Order Flow Imbalance Data */
export interface OrderFlowImbalance {
    symbol: string;
    imbalance: number; // -1 to 1 (negative = sell pressure, positive = buy pressure)
    buyVolume: number;
    sellVolume: number;
    totalVolume: number;
    timestamp: number;
}

/** Time & Sales Trade */
export interface TimeSalesTrade {
    time: number;
    price: number;
    quantity: number;
    side: 'BUY' | 'SELL';
    isBuyerMaker: boolean;
}

/** Performance Metrics */
export interface PerformanceMetrics {
    latency: {
        min: number;
        max: number;
        avg: number;
        p95: number;
    };
    memory: {
        used: number;
        total: number;
        percent: number;
    };
    messageRate: {
        binance: number;
        deribit: number;
    };
    fps: number;
    timestamp: number;
}

/** Chart Data Point for TradingView */
export interface ChartDataPoint {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
}

/** Volume Profile Data */
export interface VolumeProfileLevel {
    price: number;
    volume: number;
    buyVolume: number;
    sellVolume: number;
}

/** Error with Context */
export interface ErrorWithContext extends Error {
    context?: Record<string, unknown>;
    code?: string;
    retryable?: boolean;
}
