/**
 * Market Data Provenance Engine
 * 
 * Tracks data quality, lineage, and health for all market data streams.
 * Provides real-time monitoring of:
 * - Message latency (exchange → client)
 * - Gap detection (missing ticks)
 * - Feed health status
 * - Sequence number tracking
 * 
 * @example
 * ```typescript
 * const engine = new ProvenanceEngine('BTCUSDT');
 * const enrichedData = engine.augment({
 *   time: 1700000000,
 *   open: 45000,
 *   high: 45100,
 *   low: 44900,
 *   close: 45050,
 *   volume: 123.45
 * }, 1699999950); // exchange timestamp
 * 
 * console.log(enrichedData.provenance.latencyMs); // 50ms
 * console.log(enrichedData.provenance.feedStatus); // 'LIVE'
 * ```
 */

import type { OHLCV, ProvenanceOHLCV, DataProvenance, FeedStatus, LatencyDistribution } from '@/types/common';

interface ProvenanceState {
    symbol: string;
    lastSequenceNumber: number;
    lastReceivedTimestamp: number;
    latencySamples: number[];
    maxSamples: number;
    gapThresholdMs: number;
    staleThresholdMs: number;
    feedStatus: FeedStatus;
}

export class ProvenanceEngine {
    private state: ProvenanceState;

    constructor(
        symbol: string,
        options: {
            maxSamples?: number;
            gapThresholdMs?: number;
            staleThresholdMs?: number;
        } = {}
    ) {
        this.state = {
            symbol,
            lastSequenceNumber: 0,
            lastReceivedTimestamp: 0,
            latencySamples: [],
            maxSamples: options.maxSamples ?? 1000,
            gapThresholdMs: options.gapThresholdMs ?? 100,
            staleThresholdMs: options.staleThresholdMs ?? 5000,
            feedStatus: 'DISCONNECTED'
        };
    }

    /**
     * Augment OHLCV data with provenance metadata
     * @param data - Raw OHLCV data
     * @param exchangeTimestamp - Exchange-reported timestamp (ms)
     * @returns OHLCV data with provenance
     */
    augment(data: OHLCV, exchangeTimestamp: number): ProvenanceOHLCV {
        const receivedTimestamp = Date.now();
        const latencyMs = receivedTimestamp - exchangeTimestamp;

        // Increment sequence number
        this.state.lastSequenceNumber++;

        // Detect gap (>100ms since last tick)
        const timeSinceLastTick = receivedTimestamp - this.state.lastReceivedTimestamp;
        const isSuspectedGap = this.state.lastReceivedTimestamp > 0 &&
            timeSinceLastTick > this.state.gapThresholdMs;

        // Update feed status
        const feedStatus = this.determineFeedStatus(latencyMs, timeSinceLastTick);

        // Update latency samples
        this.updateLatencySamples(latencyMs);

        // Update state
        this.state.lastReceivedTimestamp = receivedTimestamp;
        this.state.feedStatus = feedStatus;

        const provenance: DataProvenance = {
            exchangeTimestamp,
            receivedTimestamp,
            sequenceNumber: this.state.lastSequenceNumber,
            latencyMs,
            isSuspectedGap,
            feedStatus
        };

        return {
            ...data,
            provenance
        };
    }

    /**
     * Determine feed status based on latency and time since last tick
     */
    private determineFeedStatus(latencyMs: number, timeSinceLastTick: number): FeedStatus {
        // Check if feed is stale (no data for >5 seconds)
        if (this.state.lastReceivedTimestamp > 0 && timeSinceLastTick > this.state.staleThresholdMs) {
            return 'STALE';
        }

        // Check if latency is acceptable (<1000ms = LIVE)
        if (latencyMs < 1000) {
            return 'LIVE';
        }

        // High latency but still receiving data
        return 'LIVE';
    }

    /**
     * Update latency samples for percentile calculation
     */
    private updateLatencySamples(latencyMs: number): void {
        this.state.latencySamples.push(latencyMs);

        // Keep only last N samples
        if (this.state.latencySamples.length > this.state.maxSamples) {
            this.state.latencySamples.shift();
        }
    }

    /**
     * Calculate latency distribution (p50, p95, p99)
     */
    getLatencyDistribution(): LatencyDistribution {
        if (this.state.latencySamples.length === 0) {
            return {
                p50: 0,
                p95: 0,
                p99: 0,
                samples: [],
                lastUpdated: Date.now()
            };
        }

        const sorted = [...this.state.latencySamples].sort((a, b) => a - b);

        return {
            p50: this.percentile(sorted, 0.50),
            p95: this.percentile(sorted, 0.95),
            p99: this.percentile(sorted, 0.99),
            samples: sorted,
            lastUpdated: Date.now()
        };
    }

    /**
     * Calculate percentile from sorted array
     */
    private percentile(sortedArray: number[], p: number): number {
        if (sortedArray.length === 0) return 0;

        const index = Math.ceil(sortedArray.length * p) - 1;
        return sortedArray[Math.max(0, index)]!;
    }

    /**
     * Get current feed status
     */
    getFeedStatus(): FeedStatus {
        // Check if feed has gone stale
        const now = Date.now();
        const timeSinceLastTick = now - this.state.lastReceivedTimestamp;

        if (this.state.lastReceivedTimestamp > 0 && timeSinceLastTick > this.state.staleThresholdMs) {
            this.state.feedStatus = 'STALE';
        }

        return this.state.feedStatus;
    }

    /**
     * Mark feed as disconnected
     */
    markDisconnected(): void {
        this.state.feedStatus = 'DISCONNECTED';
    }

    /**
     * Mark feed as replay mode (historical data)
     */
    markReplay(): void {
        this.state.feedStatus = 'REPLAY';
    }

    /**
     * Reset provenance state
     */
    reset(): void {
        this.state.lastSequenceNumber = 0;
        this.state.lastReceivedTimestamp = 0;
        this.state.latencySamples = [];
        this.state.feedStatus = 'DISCONNECTED';
    }

    /**
     * Get current state (for debugging)
     */
    getState(): Readonly<ProvenanceState> {
        return { ...this.state };
    }

    /**
     * Detect if there was a gap in the sequence
     * @param expectedSequence - Expected sequence number
     * @returns True if gap detected
     */
    detectSequenceGap(expectedSequence: number): boolean {
        return this.state.lastSequenceNumber !== expectedSequence;
    }

    /**
     * Get average latency
     */
    getAverageLatency(): number {
        if (this.state.latencySamples.length === 0) return 0;

        const sum = this.state.latencySamples.reduce((acc, val) => acc + val, 0);
        return sum / this.state.latencySamples.length;
    }

    /**
     * Get min/max latency
     */
    getLatencyRange(): { min: number; max: number } {
        if (this.state.latencySamples.length === 0) {
            return { min: 0, max: 0 };
        }

        return {
            min: Math.min(...this.state.latencySamples),
            max: Math.max(...this.state.latencySamples)
        };
    }

    /**
     * Check if feed is healthy
     */
    isHealthy(): boolean {
        const status = this.getFeedStatus();
        return status === 'LIVE' || status === 'REPLAY';
    }

    /**
     * Get quality score (0-100)
     * Based on latency and feed status
     */
    getQualityScore(): number {
        const status = this.getFeedStatus();

        if (status === 'DISCONNECTED') return 0;
        if (status === 'STALE') return 25;
        if (status === 'REPLAY') return 75;

        // LIVE - score based on latency
        const avgLatency = this.getAverageLatency();

        if (avgLatency < 50) return 100;
        if (avgLatency < 100) return 90;
        if (avgLatency < 200) return 80;
        if (avgLatency < 500) return 70;
        if (avgLatency < 1000) return 60;
        return 50;
    }
}

/**
 * Global provenance engine registry
 * Maintains one engine per symbol
 */
class ProvenanceEngineRegistry {
    private engines: Map<string, ProvenanceEngine> = new Map();

    /**
     * Get or create provenance engine for symbol
     */
    getEngine(symbol: string): ProvenanceEngine {
        if (!this.engines.has(symbol)) {
            this.engines.set(symbol, new ProvenanceEngine(symbol));
        }
        return this.engines.get(symbol)!;
    }

    /**
     * Remove engine for symbol
     */
    removeEngine(symbol: string): void {
        this.engines.delete(symbol);
    }

    /**
     * Reset all engines
     */
    resetAll(): void {
        for (const engine of this.engines.values()) {
            engine.reset();
        }
    }

    /**
     * Get all symbols being tracked
     */
    getTrackedSymbols(): string[] {
        return Array.from(this.engines.keys());
    }

    /**
     * Get health summary for all symbols
     */
    getHealthSummary(): Record<string, { status: FeedStatus; quality: number }> {
        const summary: Record<string, { status: FeedStatus; quality: number }> = {};

        for (const [symbol, engine] of this.engines.entries()) {
            summary[symbol] = {
                status: engine.getFeedStatus(),
                quality: engine.getQualityScore()
            };
        }

        return summary;
    }
}

// Export singleton registry
export const provenanceRegistry = new ProvenanceEngineRegistry();
