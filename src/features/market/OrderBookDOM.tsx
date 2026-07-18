import React, { useMemo, memo } from 'react';
import { useOrderBook } from '@/hooks/useOrderBook';
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
        <div style={{
            display: 'flex',
            alignItems: 'center',
            height: '18px',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            borderBottom: '1px solid rgba(255,255,255,0.02)',
            background: 'var(--bg-panel)',
            position: 'relative'
        }}>
            {/* Bid Side (Left) */}
            <div style={{ flex: 1, textAlign: 'right', paddingRight: '8px', position: 'relative', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                {isBid && (
                    <>
                        <div style={{
                            position: 'absolute',
                            top: 2, bottom: 2, right: 0,
                            width: `${width}%`,
                            background: barColor,
                            opacity: 0.2,
                            borderLeft: `2px solid ${barColor}`
                        }} />
                        <span style={{ position: 'relative', zIndex: 1, color: 'var(--text-primary)' }}>
                            {formatBookSize(vol)}
                        </span>
                    </>
                )}
            </div>

            {/* Price Column (Center) */}
            <div style={{
                width: '80px',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#000',
                color: textColor,
                fontWeight: 'bold',
                borderLeft: '1px solid var(--border-subtle)',
                borderRight: '1px solid var(--border-subtle)'
            }}>
                {formatPrice(price)}
            </div>

            {/* Ask Side (Right) */}
            <div style={{ flex: 1, textAlign: 'left', paddingLeft: '8px', position: 'relative', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                {!isBid && (
                    <>
                        <div style={{
                            position: 'absolute',
                            top: 2, bottom: 2, left: 0,
                            width: `${width}%`,
                            background: barColor,
                            opacity: 0.2,
                            borderRight: `2px solid ${barColor}`
                        }} />
                        <span style={{ position: 'relative', zIndex: 1, color: 'var(--text-primary)' }}>
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
        const bestBid = Number(bids[0]?.[0]);
        const bestAsk = Number(asks[0]?.[0]);
        if (Number.isFinite(bestBid) && Number.isFinite(bestAsk) && bestBid > 0 && bestAsk > 0) {
            return (bestBid + bestAsk) / 2;
        }
        return Number.isFinite(bestBid) && bestBid > 0 ? bestBid : bestAsk;
    }, [asks, bids]);
    const baseAggregationStep = getAdaptiveBookStep(referencePrice);
    const aggregationStep = aggregationLevel === 0
        ? null
        : baseAggregationStep * (10 ** (aggregationLevel - 1));

    // Process data for visualization
    const { rows, maxVol, spread } = useMemo(() => {
        if (!bids.length || !asks.length) return { rows: [], maxVol: 0, spread: 0 };

        // Helper to aggregate levels
        const aggregate = (levels: [string, string][], prec: number, side: 'bid' | 'ask') => {
            const map = new Map<number, number>();
            levels.forEach(([p, v]) => {
                const price = parseFloat(p);
                const vol = parseFloat(v);
                const bucket = (side === 'ask' ? Math.ceil(price / prec) : Math.floor(price / prec)) * prec;
                map.set(bucket, (map.get(bucket) || 0) + vol);
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
            processedAsks = (asks as [string, string][]).slice(0, DEPTH).reverse().map(([p, v]) => ({ price: parseFloat(p), vol: parseFloat(v), type: 'ask' as const }));
            processedBids = (bids as [string, string][]).slice(0, DEPTH).map(([p, v]) => ({ price: parseFloat(p), vol: parseFloat(v), type: 'bid' as const }));
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
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-panel)', fontFamily: 'var(--font-mono)' }}>
            {/* Header */}
            <div style={{
                padding: '8px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '10px',
                background: 'rgba(51, 255, 0, 0.05)'
            }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--accent-primary)' }}>&gt; DOM_LADDER</span>
                    {/* Precision Toggles */}
                    <div style={{ display: 'flex', border: '1px solid var(--border-subtle)' }}>
                        {([0, 1, 2] as const).map((level) => {
                            const step = level === 0
                                ? null
                                : baseAggregationStep * (10 ** (level - 1));
                            return (
                            <button
                                key={level}
                                onClick={() => setAggregationState({ symbol, level })}
                                style={{
                                    padding: '2px 6px',
                                    background: aggregationLevel === level ? 'var(--accent-primary)' : 'transparent',
                                    color: aggregationLevel === level ? '#000' : 'var(--text-secondary)',
                                    border: 'none',
                                    fontSize: '9px',
                                    cursor: 'pointer',
                                    fontFamily: 'var(--font-mono)'
                                }}
                            >
                                {step === null ? 'RAW' : formatAggregationStep(step)}
                            </button>
                            );
                        })}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>SPREAD: <span style={{ color: '#fff' }}>{spread > 0 ? formatPrice(spread) : '—'}</span></span>
                    <span className={isConnected ? "text-glow" : ""} style={{ color: isConnected ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                        {isConnected ? '[LINK_OK]' : '[NO_LINK]'}
                    </span>
                </div>
            </div>

            {/* Column Headers */}
            <div style={{
                display: 'flex',
                fontSize: '9px',
                color: 'var(--text-muted)',
                padding: '4px 0',
                borderBottom: '1px solid var(--border-subtle)',
                background: '#000'
            }}>
                <div style={{ flex: 1, textAlign: 'right', paddingRight: '8px' }}>BID_VOL</div>
                <div style={{ width: '80px', textAlign: 'center' }}>PRICE</div>
                <div style={{ flex: 1, textAlign: 'left', paddingLeft: '8px' }}>ASK_VOL</div>
            </div>

            {/* Ladder */}
            <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                {rows.map((row, i) => (
                    <RowItem
                        key={`${row.type}-${row.price}-${i}`}
                        row={row}
                        maxVol={maxVol}
                    />
                ))}
                {rows.length === 0 && (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
                        AWAITING_DATA_STREAM...
                    </div>
                )}
            </div>
        </div>
    );
};

export default OrderBookDOM;
