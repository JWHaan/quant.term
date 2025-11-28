import { Candle } from '../types/DataSource';

export class DataThinner {
    private buffer: Candle[] = [];
    private lastEmitTime: number = 0;
    private throttleMs: number;

    constructor(throttleMs: number = 100) {
        this.throttleMs = throttleMs;
    }

    /**
     * Add a new candle to the buffer and return aggregated candle if throttle time passed
     * @param candle New candle data
     * @returns Aggregated candle or null
     */
    process(candle: Candle): Candle | null {
        this.buffer.push(candle);

        const now = Date.now();
        if (now - this.lastEmitTime >= this.throttleMs) {
            return this.flush();
        }

        return null;
    }

    /**
     * Force flush the buffer
     */
    flush(): Candle | null {
        if (this.buffer.length === 0) return null;

        const aggregated = this.aggregate(this.buffer);
        this.buffer = [];
        this.lastEmitTime = Date.now();

        return aggregated;
    }

    private aggregate(candles: Candle[]): Candle {
        if (candles.length === 0) throw new Error("Cannot aggregate empty candles");

        const first = candles[0];
        const last = candles[candles.length - 1];

        if (!first || !last) throw new Error("Invalid candle buffer");

        // We need to handle Money types correctly. 
        // Assuming Money is an object with .toNumber() or similar for comparison, 
        // but for aggregation we should keep them as Money if possible.
        // However, finding min/max with Money requires comparison.

        let high = first.high;
        let low = first.low;
        let volume = first.volume;

        for (let i = 1; i < candles.length; i++) {
            const c = candles[i];
            if (!c) continue;

            if (c.high.greaterThan(high)) high = c.high;
            if (c.low.lessThan(low)) low = c.low;
            volume = volume.plus(c.volume);
        }

        return {
            timestamp: last.timestamp,
            open: first.open,
            high: high,
            low: low,
            close: last.close,
            volume: volume,
            symbol: first.symbol,
            interval: first.interval,
            source: first.source
        };
    }
}
