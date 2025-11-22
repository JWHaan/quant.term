import React, { useState, useEffect, useRef } from 'react';
import { subscribeLiquidations } from '../services/liquidationService';
import { TrendingDown, TrendingUp, Droplets } from 'lucide-react';

interface LiquidationFeedProps {
    symbol?: string;
}

interface Liquidation {
    id: string;
    time: number;
    side: 'LONG' | 'SHORT';
    price: number;
    amount: number;
    value: number;
    symbol: string;
}

interface LiquidationStats {
    totalVol: number;
    longVol: number;
    shortVol: number;
}

/**
 * Liquidation Feed (The "Rekt" Tape)
 * Displays raw, real-time forced liquidation orders from Binance Futures.
 * Source: wss://fstream.binance.com/ws/!forceOrder@arr (ALL symbols)
 */
const LiquidationFeed: React.FC<LiquidationFeedProps> = ({ symbol = 'BTCUSDT' }) => {
    const [liquidations, setLiquidations] = useState<Liquidation[]>([]);
    const [stats, setStats] = useState<LiquidationStats>({ totalVol: 0, longVol: 0, shortVol: 0 });
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        const handleLiquidation = (liq: any) => {
            // Filter by selected symbol
            if (liq.symbol !== symbol) return;

            const newLiq: Liquidation = {
                id: `${liq.time}-${Math.random().toString(36).substr(2, 9)}`,
                time: liq.time,
                side: liq.isBuy ? 'SHORT' : 'LONG', // BUY order = short squeeze, SELL order = long liquidation
                price: liq.price,
                amount: liq.quantity,
                value: liq.value,
                symbol: liq.symbol
            };

            setLiquidations(prev => [newLiq, ...prev].slice(0, 50));

            setStats(prev => ({
                totalVol: prev.totalVol + liq.value,
                longVol: !liq.isBuy ? prev.longVol + liq.value : prev.longVol,
                shortVol: liq.isBuy ? prev.shortVol + liq.value : prev.shortVol
            }));
        };

        wsRef.current = subscribeLiquidations(handleLiquidation);

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [symbol]);

    const formatValue = (val: number) => {
        if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
        if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
        return `$${val.toFixed(0)}`;
    };

    const formatTime = (ts: number) => {
        const date = new Date(ts);
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#000', overflow: 'hidden' }}>
            {/* Header Stats */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                background: 'rgba(255,255,255,0.02)',
                fontSize: '10px',
                fontFamily: 'var(--font-mono)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-danger)' }}>
                    <TrendingDown size={12} />
                    <span>Longs: {formatValue(stats.longVol)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-primary)' }}>
                    <TrendingUp size={12} />
                    <span>Shorts: {formatValue(stats.shortVol)}</span>
                </div>
            </div>

            {/* Column Headers */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '50px 1fr 1fr 60px',
                padding: '4px 8px',
                fontSize: '9px',
                color: 'var(--text-muted)',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                textTransform: 'uppercase',
                fontFamily: 'var(--font-mono)'
            }}>
                <div>Time</div>
                <div>Price</div>
                <div>Value</div>
                <div style={{ textAlign: 'right' }}>Side</div>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
                {liquidations.length === 0 ? (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        color: 'var(--text-muted)',
                        fontSize: '11px',
                        gap: '8px',
                        opacity: 0.6
                    }}>
                        <Droplets size={24} />
                        <span>Waiting for liquidations...</span>
                        <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)' }}>Real-time !forceOrder@arr</span>
                    </div>
                ) : (
                    liquidations.map(liq => (
                        <div
                            key={liq.id}
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '50px 1fr 1fr 60px',
                                padding: '4px 8px',
                                fontSize: '11px',
                                fontFamily: 'var(--font-mono)',
                                borderBottom: '1px solid rgba(255,255,255,0.02)',
                                background: liq.value > 10000 ? (liq.side === 'LONG' ? 'rgba(255,0,85,0.1)' : 'rgba(0,255,157,0.1)') : 'transparent',
                                animation: 'fadeIn 0.2s ease-out'
                            }}
                        >
                            <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{formatTime(liq.time)}</div>
                            <div style={{ color: '#fff' }}>{liq.price.toFixed(2)}</div>
                            <div style={{ fontWeight: liq.value > 10000 ? 'bold' : 'normal' }}>
                                {formatValue(liq.value)}
                            </div>
                            <div style={{
                                textAlign: 'right',
                                color: liq.side === 'LONG' ? 'var(--accent-danger)' : 'var(--accent-primary)',
                                fontWeight: 'bold'
                            }}>
                                {liq.side}
                            </div>
                        </div>
                    ))
                )}
            </div>

            <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(-5px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
        </div>
    );
};

export default LiquidationFeed;
