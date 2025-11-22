import React, { useState } from 'react';
import { usePortfolioStore } from '../stores/portfolioStore';
import { Plus } from 'lucide-react';
import { StatCard } from './portfolio/StatCard';
import { PositionCard } from './portfolio/PositionCard';
import { NewPositionForm } from './portfolio/NewPositionForm';


/**
 * PortfolioManager - Real position tracking with P&L calculation
 * Paper trading for educational purposes
 */

interface PortfolioManagerProps {
    currentPrice?: number;
    symbol: string;
}

export const PortfolioManager: React.FC<PortfolioManagerProps> = ({ currentPrice, symbol }) => {
    const { positions, addPosition, removePosition, updatePosition } = usePortfolioStore();
    const [showForm, setShowForm] = useState(false);

    // Helper to calculate stats locally since store doesn't provide them yet
    const getStats = () => {
        const closedPositions = positions.filter(p => p.status === 'CLOSED');
        const totalTrades = closedPositions.length;
        const winningTrades = closedPositions.filter(p => p.pnl > 0).length;
        const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

        const grossProfit = closedPositions.filter(p => p.pnl > 0).reduce((acc, p) => acc + p.pnl, 0);
        const grossLoss = Math.abs(closedPositions.filter(p => p.pnl < 0).reduce((acc, p) => acc + p.pnl, 0));
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

        const totalPnL = positions.reduce((acc, p) => acc + p.pnl, 0);

        return {
            totalPnL,
            winRate,
            totalTrades,
            profitFactor
        };
    };

    const stats = getStats();
    const openPositions = positions.filter(p => p.status === 'OPEN' && p.symbol === symbol);

    const handleClosePosition = (id: string, exitPrice: number) => {
        const position = positions.find(p => p.id === id);
        if (!position) return;

        // Calculate final P&L
        const multiplier = position.side === 'LONG' ? 1 : -1;
        const priceDiff = exitPrice - position.entryPrice;
        const pnl = multiplier * priceDiff * position.size;
        const pnlPercent = (pnl / (position.entryPrice * position.size)) * 100;

        updatePosition(position.symbol, {
            status: 'CLOSED',
            exitPrice,
            exitTime: Date.now(),
            pnl,
            pnlPercent
        });
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Stats Header */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '6px',
                padding: '12px',
                borderBottom: '1px solid var(--border-color)',
                background: 'rgba(0,0,0,0.2)'
            }}>
                <StatCard label="Total P&L" value={`$${stats.totalPnL.toFixed(2)}`} isPositive={stats.totalPnL >= 0} />
                <StatCard label="Win Rate" value={`${stats.winRate.toFixed(0)}%`} />
                <StatCard label="Trades" value={stats.totalTrades} />
                <StatCard label="Profit Factor" value={stats.profitFactor.toFixed(2)} isPositive={stats.profitFactor > 1} />
            </div>

            {/* Positions List */}
            <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px'
                }}>
                    <h4 style={{
                        fontSize: '11px',
                        color: 'var(--text-secondary)',
                        margin: 0,
                        letterSpacing: '1px'
                    }}>
                        OPEN POSITIONS ({openPositions.length})
                    </h4>
                    <button
                        onClick={() => setShowForm(!showForm)}
                        style={{
                            padding: '4px 10px',
                            background: 'var(--accent-primary)',
                            border: 'none',
                            borderRadius: '4px',
                            color: '#000',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        <Plus size={12} />
                        New Position
                    </button>
                </div>

                {openPositions.length === 0 && !showForm && (
                    <div style={{
                        textAlign: 'center',
                        padding: '40px 20px',
                        color: 'var(--text-muted)',
                        fontSize: '12px'
                    }}>
                        <p>No open positions</p>
                        <p style={{ fontSize: '11px', marginTop: '8px' }}>
                            Click "New Position" to track a paper trade
                        </p>
                    </div>
                )}

                {openPositions.map(position => (
                    <PositionCard
                        key={position.id}
                        position={{
                            id: position.id,
                            symbol: position.symbol,
                            side: position.side.toLowerCase() as 'long' | 'short',
                            entry: position.entryPrice,
                            size: position.size,
                            openedAt: position.timestamp
                        }}
                        currentPrice={currentPrice}
                        onClose={(exitPrice) => handleClosePosition(position.id, exitPrice)}
                        onDelete={() => removePosition(position.symbol)}
                    />
                ))}

                {showForm && (
                    <NewPositionForm
                        symbol={symbol}
                        currentPrice={currentPrice}
                        onSubmit={(pos) => {
                            addPosition({
                                id: Math.random().toString(36).substr(2, 9),
                                symbol: pos.symbol,
                                side: pos.side.toUpperCase() as 'LONG' | 'SHORT',
                                entryPrice: pos.entry,
                                size: pos.size,
                                leverage: 1, // Default leverage
                                status: 'OPEN',
                                currentPrice: pos.entry
                            });
                            setShowForm(false);
                        }}
                        onCancel={() => setShowForm(false)}
                    />
                )}
            </div>
        </div>
    );
};

export default PortfolioManager;
