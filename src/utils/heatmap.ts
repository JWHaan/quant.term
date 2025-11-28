import type { OrderBookSnapshot } from '@/stores/orderBookHistoryStore';

export interface HeatmapBinConfig {
    timeBinSeconds: number;
    priceBinSize: number;
    timeWindowMinutes: number;
    maxPriceLevels?: number;
}

export interface HeatmapCell {
    time: number;
    price: number;
    bidSize: number;
    askSize: number;
    totalSize: number;
}

export interface HeatmapAggregationResult {
    cells: HeatmapCell[];
    timeExtent: [number, number] | null;
    priceExtent: [number, number] | null;
    maxBidSize: number;
    maxAskSize: number;
    isEmpty: boolean;
}

const DEFAULT_BIN_CONFIG: HeatmapBinConfig = {
    timeBinSeconds: 10,
    priceBinSize: 0.5,
    timeWindowMinutes: 15,
};

const ensurePositive = (value: number, name: string) => {
    if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`${name} must be a positive finite number`);
    }
};

/**
 * Aggregate buffered order book snapshots into heatmap-ready bins.
 *
 * @param snapshots - Raw order book snapshots captured over time.
 * @param config - Binning configuration. Missing values fall back to sensible defaults.
 * @param now - Current timestamp used to trim the rolling window. Defaults to Date.now().
 */
export const aggregateOrderBookSnapshotsToHeatmap = (
    snapshots: OrderBookSnapshot[],
    config: Partial<HeatmapBinConfig> = {},
    now: number = Date.now()
): HeatmapAggregationResult => {
    const {
        timeBinSeconds,
        priceBinSize,
        timeWindowMinutes,
        maxPriceLevels,
    } = { ...DEFAULT_BIN_CONFIG, ...config };

    ensurePositive(timeBinSeconds, 'timeBinSeconds');
    ensurePositive(priceBinSize, 'priceBinSize');
    ensurePositive(timeWindowMinutes, 'timeWindowMinutes');

    if (snapshots.length === 0) {
        return {
            cells: [],
            timeExtent: null,
            priceExtent: null,
            maxBidSize: 0,
            maxAskSize: 0,
            isEmpty: true,
        };
    }

    const timeWindowMs = timeWindowMinutes * 60 * 1000;
    const startTime = now - timeWindowMs;
    const timeBinMs = timeBinSeconds * 1000;

    const relevantSnapshots = snapshots.filter((snapshot) => snapshot.timestamp >= startTime);

    if (relevantSnapshots.length === 0) {
        return {
            cells: [],
            timeExtent: null,
            priceExtent: null,
            maxBidSize: 0,
            maxAskSize: 0,
            isEmpty: true,
        };
    }

    const cellMap = new Map<string, HeatmapCell>();
    let minPrice = Number.POSITIVE_INFINITY;
    let maxPrice = Number.NEGATIVE_INFINITY;

    relevantSnapshots.forEach((snapshot) => {
        const timeBin = Math.floor(snapshot.timestamp / timeBinMs) * timeBinMs;
        const keyPrefix = `t-${timeBin}`;

        const processSide = (levels: Map<number, number>, type: 'bid' | 'ask') => {
            const entries = Array.from(levels.entries());

            entries.forEach(([price, size], index) => {
                if (!Number.isFinite(price) || !Number.isFinite(size) || size <= 0) {
                    return;
                }

                if (maxPriceLevels && index >= maxPriceLevels) {
                    return;
                }

                const priceBin = Math.floor(price / priceBinSize) * priceBinSize;
                const cellKey = `${keyPrefix}-${priceBin}`;

                minPrice = Math.min(minPrice, priceBin);
                maxPrice = Math.max(maxPrice, priceBin);

                const existing = cellMap.get(cellKey);

                if (existing) {
                    if (type === 'bid') {
                        existing.bidSize += size;
                    } else {
                        existing.askSize += size;
                    }
                    existing.totalSize += size;
                    return;
                }

                cellMap.set(cellKey, {
                    time: timeBin,
                    price: priceBin,
                    bidSize: type === 'bid' ? size : 0,
                    askSize: type === 'ask' ? size : 0,
                    totalSize: size,
                });
            });
        };

        processSide(snapshot.bids, 'bid');
        processSide(snapshot.asks, 'ask');
    });

    const cells = Array.from(cellMap.values()).sort((a, b) =>
        a.time === b.time ? a.price - b.price : a.time - b.time
    );

    const maxBidSize = cells.reduce((max, cell) => Math.max(max, cell.bidSize), 0);
    const maxAskSize = cells.reduce((max, cell) => Math.max(max, cell.askSize), 0);

    const timeExtent = cells.length > 0
        ? [cells[0]!.time, cells[cells.length - 1]!.time] as [number, number]
        : null;

    const priceExtent = cells.length > 0 && Number.isFinite(minPrice) && Number.isFinite(maxPrice)
        ? [minPrice, maxPrice] as [number, number]
        : null;

    return {
        cells,
        timeExtent,
        priceExtent,
        maxBidSize,
        maxAskSize,
        isEmpty: cells.length === 0,
    };
};

export const mergeHeatmapConfig = (
    base: Partial<HeatmapBinConfig> | undefined,
    overrides: Partial<HeatmapBinConfig> | undefined,
): HeatmapBinConfig => ({
    ...DEFAULT_BIN_CONFIG,
    ...base,
    ...overrides,
});
