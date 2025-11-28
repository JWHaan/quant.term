/**
 * Data Quality Monitor
 * 
 * Tracks and validates market data accuracy with:
 * - Checksum validation for order book integrity
 * - Gap detection in trade sequences
 * - Latency monitoring
 * - Anomaly detection
 */

export interface DataQualityMetrics {
    checksumFailures: number;
    gapDetections: number;
    averageLatency: number;
    maxLatency: number;
    updateRate: number; // Updates per second
    lastChecksum: string | null;
    isHealthy: boolean;
}

export interface DataQualityAlert {
    type: 'CHECKSUM_FAIL' | 'GAP_DETECTED' | 'HIGH_LATENCY' | 'STALE_DATA' | 'RECONNECT';
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    message: string;
    timestamp: number;
}

class DataQualityMonitor {
    private metrics: Map<string, DataQualityMetrics> = new Map();
    private alerts: DataQualityAlert[] = [];
    private latencyBuffer: Map<string, number[]> = new Map();
    private lastTradeIds: Map<string, number> = new Map();
    private updateTimestamps: Map<string, number[]> = new Map();

    // Initialize metrics for a symbol
    initSymbol(symbol: string): void {
        if (!this.metrics.has(symbol)) {
            this.metrics.set(symbol, {
                checksumFailures: 0,
                gapDetections: 0,
                averageLatency: 0,
                maxLatency: 0,
                updateRate: 0,
                lastChecksum: null,
                isHealthy: true
            });
            this.latencyBuffer.set(symbol, []);
            this.updateTimestamps.set(symbol, []);
        }
    }

    // Validate order book checksum (Binance-specific CRC32)
    validateChecksum(symbol: string, orderBook: any, providedChecksum?: string): boolean {
        this.initSymbol(symbol);

        if (!providedChecksum) {
            // If no checksum provided, skip validation
            return true;
        }

        try {
            // Simplified checksum validation
            // In production, implement full CRC32 calculation
            const calculatedChecksum = this.calculateChecksum(orderBook);

            const metrics = this.metrics.get(symbol)!;
            metrics.lastChecksum = calculatedChecksum;

            if (calculatedChecksum !== providedChecksum) {
                metrics.checksumFailures++;
                metrics.isHealthy = false;

                this.addAlert({
                    type: 'CHECKSUM_FAIL',
                    severity: 'HIGH',
                    message: `Checksum mismatch for ${symbol}. Data may be corrupted.`,
                    timestamp: Date.now()
                });

                return false;
            }

            return true;
        } catch (e) {
            console.error('Checksum validation error:', e);
            return false;
        }
    }

    // Simplified checksum calculation (placeholder for CRC32)
    private calculateChecksum(orderBook: any): string {
        // In production, implement proper CRC32 algorithm
        // This is a simplified version for demonstration
        const data = JSON.stringify({
            bids: orderBook.bids?.slice(0, 10),
            asks: orderBook.asks?.slice(0, 10)
        });

        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }

        return Math.abs(hash).toString(16);
    }

    // Detect gaps in trade sequence
    detectTradeGap(symbol: string, tradeId: number): boolean {
        this.initSymbol(symbol);

        const lastId = this.lastTradeIds.get(symbol);

        if (lastId !== undefined && tradeId > lastId + 1) {
            const gap = tradeId - lastId - 1;
            const metrics = this.metrics.get(symbol)!;
            metrics.gapDetections++;

            this.addAlert({
                type: 'GAP_DETECTED',
                severity: gap > 10 ? 'HIGH' : 'MEDIUM',
                message: `Trade gap detected for ${symbol}: ${gap} trades missing (${lastId} -> ${tradeId})`,
                timestamp: Date.now()
            });

            this.lastTradeIds.set(symbol, tradeId);
            return true;
        }

        this.lastTradeIds.set(symbol, tradeId);
        return false;
    }

    // Record latency measurement
    recordLatency(symbol: string, latencyMs: number): void {
        this.initSymbol(symbol);

        const buffer = this.latencyBuffer.get(symbol)!;
        buffer.push(latencyMs);

        // Keep only last 100 measurements
        if (buffer.length > 100) {
            buffer.shift();
        }

        const metrics = this.metrics.get(symbol)!;
        metrics.averageLatency = buffer.reduce((a, b) => a + b, 0) / buffer.length;
        metrics.maxLatency = Math.max(...buffer);

        // Alert on high latency
        if (latencyMs > 1000) {
            this.addAlert({
                type: 'HIGH_LATENCY',
                severity: latencyMs > 2000 ? 'HIGH' : 'MEDIUM',
                message: `High latency detected for ${symbol}: ${latencyMs}ms`,
                timestamp: Date.now()
            });
        }
    }

    // Record update timestamp and calculate update rate
    recordUpdate(symbol: string): void {
        this.initSymbol(symbol);

        const now = Date.now();
        const timestamps = this.updateTimestamps.get(symbol)!;
        timestamps.push(now);

        // Keep only last 60 seconds of timestamps
        const cutoff = now - 60000;
        while (timestamps.length > 0 && timestamps[0] !== undefined && timestamps[0] < cutoff) {
            timestamps.shift();
        }

        const metrics = this.metrics.get(symbol)!;
        metrics.updateRate = timestamps.length / 60; // Updates per second (averaged over 60s)
    }

    // Check for stale data
    checkStaleData(symbol: string, lastUpdateTime: number): boolean {
        const age = Date.now() - lastUpdateTime;

        if (age > 2000) {
            this.addAlert({
                type: 'STALE_DATA',
                severity: age > 5000 ? 'HIGH' : 'MEDIUM',
                message: `Stale data for ${symbol}: ${(age / 1000).toFixed(1)}s old`,
                timestamp: Date.now()
            });

            return true;
        }

        return false;
    }

    // Record reconnection event
    recordReconnect(symbol: string): void {
        this.addAlert({
            type: 'RECONNECT',
            severity: 'MEDIUM',
            message: `WebSocket reconnected for ${symbol}`,
            timestamp: Date.now()
        });
    }

    // Add alert to buffer
    private addAlert(alert: DataQualityAlert): void {
        this.alerts.push(alert);

        // Keep only last 100 alerts
        if (this.alerts.length > 100) {
            this.alerts.shift();
        }

        // Log high severity alerts
        if (alert.severity === 'HIGH') {
            console.warn('Data Quality Alert:', alert);
        }
    }

    // Get metrics for a symbol
    getMetrics(symbol: string): DataQualityMetrics | null {
        return this.metrics.get(symbol) || null;
    }

    // Get recent alerts
    getAlerts(limit: number = 10): DataQualityAlert[] {
        return this.alerts.slice(-limit).reverse();
    }

    // Clear alerts
    clearAlerts(): void {
        this.alerts = [];
    }

    // Reset metrics for a symbol
    resetMetrics(symbol: string): void {
        this.metrics.delete(symbol);
        this.latencyBuffer.delete(symbol);
        this.lastTradeIds.delete(symbol);
        this.updateTimestamps.delete(symbol);
    }
}

// Singleton instance
export const dataQualityMonitor = new DataQualityMonitor();
