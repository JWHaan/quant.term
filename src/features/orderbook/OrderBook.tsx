import React from 'react';
// @ts-ignore - react-window types may have issues
import { FixedSizeList } from 'react-window';
import { useBinanceWebSocket } from '@/hooks/useBinanceWebSocket';
import { AlertTriangle } from 'lucide-react';

interface OrderBookProps {
    symbol?: string;
}

const OrderBook: React.FC<OrderBookProps> = ({ symbol = 'btcusdt' }) => {
    const { orderBook, isConnected, lastUpdate } = useBinanceWebSocket(symbol, '1m');

    // Check if data is stale (>2 seconds old)
    const isStale = orderBook?.isStale || (Date.now() - lastUpdate > 2000);

    // Format price with appropriate decimals
    const formatPrice = (price: number): string => {
        return price >= 1000 ? price.toFixed(2) : price.toFixed(4);
    };

    // Format size
    const formatSize = (size: number): string => {
        return size.toFixed(4);
    };

    // Calculate max total for bar width
    const maxTotal = Math.max(
        ...(orderBook?.bids.map(b => b.total || 0) || [0]),
        ...(orderBook?.asks.map(a => a.total || 0) || [0])
    );

    // Render a single order book row
    const BidRow = ({ index, style }: { index: number; style: React.CSSProperties }) => {
        if (!orderBook || index >= orderBook.bids.length) return null;

        const bid = orderBook.bids[index];
        if (!bid) return null;
        const barWidth = maxTotal > 0 ? (bid.total || 0) / maxTotal * 100 : 0;

        return (
            <div style={{
                ...style,
                display: 'flex',
                alignItems: 'center',
                padding: '4px 12px',
                position: 'relative',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px'
            }}>
                {/* Background bar */}
                <div style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: `${barWidth}%`,
                    background: 'rgba(16, 185, 129, 0.15)',
                    transition: 'width 0.2s ease'
                }} />

                {/* Content */}
                <div style={{ flex: 1, zIndex: 1, color: 'var(--accent-success)' }}>
                    {formatPrice(bid.price)}
                </div>
                <div style={{ flex: 1, zIndex: 1, textAlign: 'right', color: 'var(--text-primary)' }}>
                    {formatSize(bid.size)}
                </div>
                <div style={{ flex: 1, zIndex: 1, textAlign: 'right', color: 'var(--text-secondary)' }}>
                    {formatSize(bid.total || 0)}
                </div>
            </div>
        );
    };

    const AskRow = ({ index, style }: { index: number; style: React.CSSProperties }) => {
        if (!orderBook || index >= orderBook.asks.length) return null;

        const ask = orderBook.asks[index];
        if (!ask) return null;
        const barWidth = maxTotal > 0 ? (ask.total || 0) / maxTotal * 100 : 0;

        return (
            <div style={{
                ...style,
                display: 'flex',
                alignItems: 'center',
                padding: '4px 12px',
                position: 'relative',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px'
            }}>
                {/* Background bar */}
                <div style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: `${barWidth}%`,
                    background: 'rgba(239, 68, 68, 0.15)',
                    transition: 'width 0.2s ease'
                }} />

                {/* Content */}
                <div style={{ flex: 1, zIndex: 1, color: 'var(--accent-danger)' }}>
                    {formatPrice(ask.price)}
                </div>
                <div style={{ flex: 1, zIndex: 1, textAlign: 'right', color: 'var(--text-primary)' }}>
                    {formatSize(ask.size)}
                </div>
                <div style={{ flex: 1, zIndex: 1, textAlign: 'right', color: 'var(--text-secondary)' }}>
                    {formatSize(ask.total || 0)}
                </div>
            </div>
        );
    };

    return (
        <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-panel)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border-color)',
                background: 'var(--bg-app)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                        color: 'var(--text-secondary)',
                        fontWeight: 500,
                        fontSize: '12px',
                        fontFamily: 'var(--font-ui)'
                    }}>
                        Order Book
                    </span>
                    {isStale && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 6px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid var(--accent-danger)',
                            borderRadius: '4px',
                            fontSize: '10px',
                            color: 'var(--accent-danger)'
                        }}>
                            <AlertTriangle size={10} />
                            STALE
                        </div>
                    )}
                </div>
                <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: isConnected ? 'var(--accent-success)' : 'var(--accent-danger)',
                    boxShadow: isConnected ? '0 0 8px var(--accent-success)' : 'none'
                }} />
            </div>

            {/* Column Headers */}
            <div style={{
                display: 'flex',
                padding: '8px 12px',
                borderBottom: '1px solid var(--border-color)',
                background: 'var(--bg-app)',
                fontFamily: 'var(--font-ui)',
                fontSize: '10px',
                fontWeight: 500,
                color: 'var(--text-muted)',
                textTransform: 'uppercase'
            }}>
                <div style={{ flex: 1 }}>Price</div>
                <div style={{ flex: 1, textAlign: 'right' }}>Size</div>
                <div style={{ flex: 1, textAlign: 'right' }}>Total</div>
            </div>

            {/* Asks (reversed, so lowest ask is at bottom) */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
                {orderBook && orderBook.asks.length > 0 ? (
                    <FixedSizeList
                        height={200}
                        itemCount={Math.min(orderBook.asks.length, 20)}
                        itemSize={24}
                        width="100%"
                    >
                        {AskRow}
                    </FixedSizeList>
                ) : (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        color: 'var(--text-muted)',
                        fontSize: '12px'
                    }}>
                        Loading asks...
                    </div>
                )}
            </div>

            {/* Spread */}
            {orderBook && orderBook.bids.length > 0 && orderBook.asks.length > 0 && orderBook.bids[0] && orderBook.asks[0] && (
                <div style={{
                    padding: '8px 12px',
                    background: 'var(--bg-app)',
                    borderTop: '1px solid var(--border-color)',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '8px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px'
                }}>
                    <span style={{ color: 'var(--text-muted)' }}>Spread:</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                        {formatPrice(orderBook.asks[0].price - orderBook.bids[0].price)}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>
                        ({(((orderBook.asks[0].price - orderBook.bids[0].price) / orderBook.bids[0].price) * 100).toFixed(3)}%)
                    </span>
                </div>
            )}

            {/* Bids */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
                {orderBook && orderBook.bids.length > 0 ? (
                    <FixedSizeList
                        height={200}
                        itemCount={Math.min(orderBook.bids.length, 20)}
                        itemSize={24}
                        width="100%"
                    >
                        {BidRow}
                    </FixedSizeList>
                ) : (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        color: 'var(--text-muted)',
                        fontSize: '12px'
                    }}>
                        Loading bids...
                    </div>
                )}
            </div>

            {/* Footer with timestamp */}
            <div style={{
                padding: '8px 12px',
                borderTop: '1px solid var(--border-color)',
                background: 'var(--bg-app)',
                fontSize: '10px',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-ui)',
                display: 'flex',
                justifyContent: 'space-between'
            }}>
                <span>Last Update: {new Date(lastUpdate).toLocaleTimeString()}</span>
                {orderBook && (
                    <span>ID: {orderBook.lastUpdateId}</span>
                )}
            </div>
        </div>
    );
};

export default OrderBook;
