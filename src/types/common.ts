/**
 * Common utility types and interfaces
 */

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
