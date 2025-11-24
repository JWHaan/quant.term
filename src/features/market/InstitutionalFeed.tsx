import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useBinanceWebSocket } from '@/hooks/useBinanceWebSocket';

import { Trade } from '@/hooks/useBinanceWebSocket';

interface InstitutionalFeedProps {
    symbol: string;
    onLargeTrade?: (trade: Trade) => void;
}

const InstitutionalFeed: React.FC<InstitutionalFeedProps> = ({ symbol, onLargeTrade }) => {
    const { trades } = useBinanceWebSocket(symbol);

    // Filter for "Whale" trades (e.g., > 0.5 BTC approx $50k)
    const whaleTrades = trades.filter(t => (t.size * t.price) > 50000);

    const TradeRow = ({ trade }: { trade: Trade }) => {
        const isBuy = trade.side === 'BUY';
        const value = trade.size * trade.price;

        return (
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 12px',
                borderBottom: '1px solid var(--border-color)',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                background: value > 100000 ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                transition: 'background 0.2s'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '80px' }}>
                    <span style={{
                        color: isBuy ? 'var(--accent-primary)' : 'var(--accent-danger)',
                        display: 'flex', alignItems: 'center'
                    }}>
                        {isBuy ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    </span>
                    <span style={{ color: '#fff', fontWeight: '500' }}>{trade.price.toFixed(2)}</span>
                </div>

                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{trade.size.toFixed(4)}</span>
                    <span style={{
                        color: isBuy ? 'var(--accent-primary)' : 'var(--accent-danger)',
                        width: '60px',
                        textAlign: 'right',
                        fontWeight: '600'
                    }}>
                        ${(value / 1000).toFixed(1)}k
                    </span>
                    <span style={{ color: 'var(--text-muted)', width: '50px', textAlign: 'right' }}>
                        {trade.time}
                    </span>
                </div>
            </div>
        );
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'transparent' }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderBottom: '1px solid var(--border-color)',
                fontSize: '10px',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase'
            }}>
                <span>Price</span>
                <div style={{ display: 'flex', gap: '16px' }}>
                    <span>Size</span>
                    <span style={{ width: '60px', textAlign: 'right' }}>Value</span>
                    <span style={{ width: '50px', textAlign: 'right' }}>Time</span>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
                {whaleTrades.length === 0 ? (
                    <div style={{
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column',
                        gap: '8px',
                        color: 'var(--text-muted)'
                    }}>
                        <div className="loader" style={{ width: '20px', height: '20px', border: '2px solid var(--border-color)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        <span style={{ fontSize: '12px' }}>SCANNING INSTITUTIONAL TAPE...</span>
                    </div>
                ) : (
                    whaleTrades.map((trade) => {
                        if (onLargeTrade) onLargeTrade(trade);
                        return <TradeRow key={trade.id} trade={trade} />;
                    })
                )}
            </div>
            <style>{`
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default InstitutionalFeed;
