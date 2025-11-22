import React, { useMemo } from 'react';
import { useOrderBook } from '../hooks/useOrderBook';

interface OrderBookDOMProps {
    symbol?: string;
}

interface OrderBookRow {
    price: number;
    vol: number;
    type: 'bid' | 'ask';
}

/**
 * Vertical Depth of Market (DOM) Ladder
 * Institutional-style order book visualization
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

        if (precision > 0.01) {
            // Aggregate
            const aggAsks = aggregate(asks, precision);
            const aggBids = aggregate(bids, precision);

            // Take closest to center
            // Asks: Lowest prices (last in descending list)
            processedAsks = aggAsks.slice(-15).map(([p, v]) => ({ price: p, vol: v, type: 'ask' as const }));
            // Bids: Highest prices (first in descending list)
            processedBids = aggBids.slice(0, 15).map(([p, v]) => ({ price: p, vol: v, type: 'bid' as const }));
        } else {
            // Raw (Top 15)
            processedAsks = (asks as [string, string][]).slice(0, 15).reverse().map(([p, v]) => ({ price: parseFloat(p), vol: parseFloat(v), type: 'ask' as const }));
            processedBids = (bids as [string, string][]).slice(0, 15).map(([p, v]) => ({ price: parseFloat(p), vol: parseFloat(v), type: 'bid' as const }));
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

    const Row: React.FC<OrderBookRow> = ({ price, vol, type }) => {
        const isBid = type === 'bid';
        const width = (vol / maxVol) * 100;
        const barColor = isBid ? 'rgba(0, 255, 157, 0.15)' : 'rgba(255, 59, 48, 0.15)';
        const textColor = isBid ? 'var(--accent-primary)' : 'var(--accent-danger)';

        return (
            <div style={{
                display: 'flex',
                height: '20px',
                alignItems: 'center',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                borderBottom: '1px solid rgba(255,255,255,0.02)',
                position: 'relative'
            }}>
                {/* Bid Side (Left) */}
                <div style={{ flex: 1, textAlign: 'right', paddingRight: '8px', position: 'relative' }}>
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
                    textAlign: 'center',
                    background: 'rgba(255,255,255,0.03)',
                    color: textColor,
                    fontWeight: '600',
                    borderLeft: '1px solid rgba(255,255,255,0.05)',
                    borderRight: '1px solid rgba(255,255,255,0.05)'
                }}>
                    {price.toFixed(precision >= 1 ? 0 : 2)}
                </div>

                {/* Ask Side (Right) */}
                <div style={{ flex: 1, textAlign: 'left', paddingLeft: '8px', position: 'relative' }}>
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
    };

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

            {/* Ladder */}
            <div style={{ flex: 1, overflowY: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                {rows.map((row) => (
                    <Row key={`${row.type}-${row.price}`} {...row} />
                ))}
            </div>
        </div>
    );
};

export default OrderBookDOM;
