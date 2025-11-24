import React, { useMemo, memo } from 'react';
import { useOrderBook } from '@/hooks/useOrderBook';

interface OrderBookDOMProps {
    symbol?: string;
}

interface OrderBookRow {
    price: number;
    vol: number;
    type: 'bid' | 'ask';
}

// Memoized Row Component
const RowItem = memo(({ row, maxVol, precision }: { row: OrderBookRow; maxVol: number; precision: number }) => {
    const { price, vol, type } = row;
    const isBid = type === 'bid';
    const width = (vol / maxVol) * 100;
    const barColor = isBid ? 'rgba(0, 255, 157, 0.15)' : 'rgba(255, 59, 48, 0.15)';
    const textColor = isBid ? 'var(--accent-primary)' : 'var(--accent-danger)';

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            height: '20px', // Explicit height for virtualizer
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            borderBottom: '1px solid rgba(255,255,255,0.02)',
            background: '#000'
        }}>
            {/* Bid Side (Left) */}
            <div style={{ flex: 1, textAlign: 'right', paddingRight: '8px', position: 'relative', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                {isBid && (
                    <>
                        <div style={{
                            position: 'absolute',
                            top: 1, bottom: 1, right: 0,
                            width: `${width}%`,
                            background: barColor,
                            transition: 'width 0.1s'
                        }} />
                        <span style={{ position: 'relative', zIndex: 1, color: 'var(--text-primary)' }}>
                            {vol.toFixed(precision > 1 ? 2 : 4)}
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
                background: 'rgba(255,255,255,0.03)',
                color: textColor,
                fontWeight: '600',
                borderLeft: '1px solid rgba(255,255,255,0.05)',
                borderRight: '1px solid rgba(255,255,255,0.05)'
            }}>
                {price.toFixed(precision >= 1 ? 0 : 2)}
            </div>

            {/* Ask Side (Right) */}
            <div style={{ flex: 1, textAlign: 'left', paddingLeft: '8px', position: 'relative', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                {!isBid && (
                    <>
                        <div style={{
                            position: 'absolute',
                            top: 1, bottom: 1, left: 0,
                            width: `${width}%`,
                            background: barColor,
                            transition: 'width 0.1s'
                        }} />
                        <span style={{ position: 'relative', zIndex: 1, color: 'var(--text-primary)' }}>
                            {vol.toFixed(precision > 1 ? 2 : 4)}
                        </span>
                    </>
                )}
            </div>
        </div>
    );
});

/**
 * Vertical Depth of Market (DOM) Ladder
 * Institutional-style order book visualization with Virtual Scrolling (react-virtuoso)
 */
const OrderBookDOM: React.FC<OrderBookDOMProps> = ({ symbol = 'BTCUSDT' }) => {
    const { bids, asks, isConnected } = useOrderBook(symbol);
    const [precision, setPrecision] = React.useState(0.01);

    // Process data for visualization
    const { rows, maxVol, spread } = useMemo(() => {
        if (!bids.length || !asks.length) return { rows: [], maxVol: 0, spread: 0 };

        // Helper to aggregate levels
        const aggregate = (levels: [string, string][], prec: number) => {
            const map = new Map<number, number>();
            levels.forEach(([p, v]) => {
                const price = parseFloat(p);
                const vol = parseFloat(v);
                const bucket = Math.floor(price / prec) * prec;
                map.set(bucket, (map.get(bucket) || 0) + vol);
            });
            return Array.from(map.entries()).sort((a, b) => b[0] - a[0]); // Descending price
        };

        let processedAsks: OrderBookRow[], processedBids: OrderBookRow[];
        const DEPTH = 500;

        if (precision > 0.01) {
            // Aggregate
            const aggAsks = aggregate(asks, precision);
            const aggBids = aggregate(bids, precision);

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
    }, [bids, asks, precision]);

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#000' }}>
            {/* Header */}
            <div style={{
                padding: '8px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '10px',
                color: 'var(--text-muted)'
            }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '600' }}>DOM</span>
                    {/* Precision Toggles */}
                    <div style={{ display: 'flex', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}>
                        {[0.01, 1, 10].map(p => (
                            <button
                                key={p}
                                onClick={() => setPrecision(p)}
                                style={{
                                    padding: '2px 6px',
                                    background: precision === p ? 'var(--accent-primary)' : 'transparent',
                                    color: precision === p ? '#000' : 'var(--text-secondary)',
                                    border: 'none',
                                    fontSize: '9px',
                                    cursor: 'pointer',
                                    fontFamily: 'var(--font-mono)'
                                }}
                            >
                                {p === 0.01 ? 'Raw' : p}
                            </button>
                        ))}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', fontFamily: 'var(--font-mono)' }}>
                    <span>Spread: <span style={{ color: '#fff' }}>{spread.toFixed(2)}</span></span>
                    <span style={{ color: isConnected ? 'var(--accent-primary)' : 'var(--accent-danger)' }}>
                        {isConnected ? '●' : '○'}
                    </span>
                </div>
            </div>

            {/* Column Headers */}
            <div style={{
                display: 'flex',
                fontSize: '9px',
                color: 'var(--text-muted)',
                padding: '4px 0',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                fontFamily: 'var(--font-mono)'
            }}>
                <div style={{ flex: 1, textAlign: 'right', paddingRight: '8px' }}>BID SIZE</div>
                <div style={{ width: '80px', textAlign: 'center' }}>PRICE</div>
                <div style={{ flex: 1, textAlign: 'left', paddingLeft: '8px' }}>ASK SIZE</div>
            </div>

            {/* Standard Ladder (Non-Virtualized for Stability) */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                {rows.slice(0, 50).map((row, i) => (
                    <RowItem
                        key={`${row.type}-${row.price}-${i}`}
                        row={row}
                        maxVol={maxVol}
                        precision={precision}
                    />
                ))}
                {rows.length === 0 && (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Waiting for data...
                    </div>
                )}
            </div>
        </div>
    );
};

export default OrderBookDOM;
