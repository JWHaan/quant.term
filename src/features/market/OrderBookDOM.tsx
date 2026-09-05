import React, { useMemo, memo } from 'react';
import { useOrderBook } from '@/hooks/useOrderBook';
import type { OrderBookLevel } from '@/hooks/useOrderBook';
import { formatPrice } from '@/utils/format';
import { getAdaptiveBookStep } from '@/utils/orderBookFormatting';

interface OrderBookDOMProps {
    symbol?: string;
}

interface OrderBookRow {
    price: number;
    vol: number;
    type: 'bid' | 'ask';
}

// Memoized Row Component
const formatBookSize = (value: number): string => {
    if (value >= 1_000) return value.toFixed(0);
    if (value >= 1) return value.toFixed(3);
    return value.toFixed(6);
};

const formatAggregationStep = (step: number): string => {
    const decimals = Math.min(8, Math.max(0, Math.ceil(-Math.log10(step))));
    return step.toFixed(decimals);
};

const RowItem = memo(({ row, maxVol }: { row: OrderBookRow; maxVol: number }) => {
    const { price, vol, type } = row;
    const isBid = type === 'bid';
    const width = (vol / maxVol) * 100;
    const barColor = isBid ? 'var(--accent-success)' : 'var(--accent-danger)';
    const textColor = isBid ? 'var(--accent-success)' : 'var(--accent-danger)';

    return (
        <div className="dom-row">
            {/* Bid Side (Left) */}
            <div className="dom-side dom-side--bid">
                {isBid && (
                    <>
                        <div
                            className="dom-side__bar"
                            style={{ width: `${width}%`, background: barColor, borderLeft: `2px solid ${barColor}` }}
                        />
                        <span className="dom-side__vol tnum">
                            {formatBookSize(vol)}
                        </span>
                    </>
                )}
            </div>

            {/* Price Column (Center) */}
            <div className="dom-row__price" style={{ color: textColor }}>
                {formatPrice(price)}
            </div>

            {/* Ask Side (Right) */}
            <div className="dom-side dom-side--ask">
                {!isBid && (
                    <>
                        <div
                            className="dom-side__bar"
                            style={{ width: `${width}%`, background: barColor, borderRight: `2px solid ${barColor}` }}
                        />
                        <span className="dom-side__vol tnum">
                            {formatBookSize(vol)}
                        </span>
                    </>
                )}
            </div>
        </div>
    );
});

/**
 * Vertical Depth of Market (DOM) Ladder
 * Terminal-style order book visualization
 */
const OrderBookDOM: React.FC<OrderBookDOMProps> = ({ symbol = 'BTCUSDT' }) => {
    const { bids, asks, isConnected } = useOrderBook(symbol);
    const [aggregationState, setAggregationState] = React.useState<{
        symbol: string;
        level: 0 | 1 | 2;
    }>({ symbol, level: 0 });
    const aggregationLevel = aggregationState.symbol === symbol ? aggregationState.level : 0;
    const referencePrice = useMemo(() => {
        const bestBid = bids[0]?.price;
        const bestAsk = asks[0]?.price;
        if (bestBid !== undefined && bestAsk !== undefined && bestBid > 0 && bestAsk > 0) {
            return (bestBid + bestAsk) / 2;
        }
        return bestBid !== undefined && bestBid > 0 ? bestBid : (bestAsk ?? Number.NaN);
    }, [asks, bids]);
    const baseAggregationStep = getAdaptiveBookStep(referencePrice);
    const aggregationStep = aggregationLevel === 0
        ? null
        : baseAggregationStep * (10 ** (aggregationLevel - 1));

    // Process data for visualization
    const { rows, maxVol, spread } = useMemo(() => {
        if (!bids.length || !asks.length) return { rows: [], maxVol: 0, spread: 0 };

        // Helper to aggregate levels
        const aggregate = (levels: readonly OrderBookLevel[], prec: number, side: 'bid' | 'ask') => {
            const map = new Map<number, number>();
            levels.forEach(({ price, quantity }) => {
                const bucket = (side === 'ask' ? Math.ceil(price / prec) : Math.floor(price / prec)) * prec;
                map.set(bucket, (map.get(bucket) || 0) + quantity);
            });
            return Array.from(map.entries()).sort((a, b) => b[0] - a[0]); // Descending price
        };

        let processedAsks: OrderBookRow[], processedBids: OrderBookRow[];
        const DEPTH = 50; // Reduced for terminal look

        if (aggregationStep !== null) {
            // Aggregate
            const aggAsks = aggregate(asks, aggregationStep, 'ask');
            const aggBids = aggregate(bids, aggregationStep, 'bid');

            processedAsks = aggAsks.slice(-DEPTH).map(([p, v]) => ({ price: p, vol: v, type: 'ask' as const }));
            processedBids = aggBids.slice(0, DEPTH).map(([p, v]) => ({ price: p, vol: v, type: 'bid' as const }));
        } else {
            // Raw
            processedAsks = asks.slice(0, DEPTH).reverse().map((level) => ({ price: level.price, vol: level.quantity, type: 'ask' as const }));
            processedBids = bids.slice(0, DEPTH).map((level) => ({ price: level.price, vol: level.quantity, type: 'bid' as const }));
        }

        let max = 0;
        [...processedAsks, ...processedBids].forEach(r => {
            if (r.vol > max) max = r.vol;
        });

        const spreadVal = processedAsks.length > 0 && processedBids.length > 0
            ? (processedAsks[processedAsks.length - 1]?.price || 0) - (processedBids[0]?.price || 0)
            : 0;

        return {
            rows: [...processedAsks, ...processedBids],
            maxVol: max,
            spread: spreadVal
        };
    }, [aggregationStep, bids, asks]);

    return (
        <div className="dom-ladder">
            {/* Header */}
            <div className="dom-ladder__head">
                <div className="dom-ladder__controls">
                    <span className="dom-ladder__title">&gt; DOM_LADDER</span>
                    {/* Precision Toggles */}
                    <div className="dom-ladder__seg">
                        {([0, 1, 2] as const).map((level) => {
                            const step = level === 0
                                ? null
                                : baseAggregationStep * (10 ** (level - 1));
                            return (
                                <button
                                    key={level}
                                    onClick={() => setAggregationState({ symbol, level })}
                                    className={aggregationLevel === level ? 'is-active' : undefined}
                                >
                                    {step === null ? 'RAW' : formatAggregationStep(step)}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="dom-ladder__stats">
                    <span>SPREAD: <strong className="tnum">{spread > 0 ? formatPrice(spread) : '—'}</strong></span>
                    <span className={isConnected ? "text-glow" : ""} style={{ color: isConnected ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                        {isConnected ? '[LINK_OK]' : '[NO_LINK]'}
                    </span>
                </div>
            </div>

            {/* Column Headers */}
            <div className="dom-ladder__cols">
                <div style={{ flex: 1, textAlign: 'right', paddingRight: '8px' }}>BID_VOL</div>
                <div style={{ width: '80px', textAlign: 'center' }}>PRICE</div>
                <div style={{ flex: 1, textAlign: 'left', paddingLeft: '8px' }}>ASK_VOL</div>
            </div>

            {/* Ladder */}
            <div className="dom-ladder__body no-scrollbar" style={{ display: 'flex', flexDirection: 'column' }}>
                {rows.map((row, i) => (
                    <RowItem
                        key={`${row.type}-${row.price}-${i}`}
                        row={row}
                        maxVol={maxVol}
                    />
                ))}
                {rows.length === 0 && (
                    <div className="feed-init" style={{ textAlign: 'center' }}>
                        AWAITING_DATA_STREAM...
                    </div>
                )}
            </div>
        </div>
    );
};

export default OrderBookDOM;
