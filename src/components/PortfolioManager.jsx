import React, { useState, useEffect } from 'react';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { useMarketStore } from '@/stores/marketStore';
import { TrendingUp, TrendingDown, X, Plus, Edit2, Wallet } from 'lucide-react';

/**
 * PortfolioManager - Real position tracking with P&L calculation
 * Paper trading for educational purposes
 */
export const PortfolioManager = ({ currentPrice, symbol }) => {
    const { positions, addPosition, closePosition, deletePosition, getStats } = usePortfolioStore();
    const [showForm, setShowForm] = useState(false);
    const [editingPosition, setEditingPosition] = useState(null);

    const stats = getStats();
    const openPositions = positions.filter(p => p.status === 'open' && p.symbol === symbol);

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
                        position={position}
                        currentPrice={currentPrice}
                        onClose={(exitPrice) => {
                            closePosition(position.id, exitPrice);
                            setEditingPosition(null);
                        }}
                        onDelete={() => deletePosition(position.id)}
                    />
                ))}

                {showForm && (
                    <NewPositionForm
                        symbol={symbol}
                        currentPrice={currentPrice}
                        onSubmit={(pos) => {
                            addPosition(pos);
                            setShowForm(false);
                        }}
                        onCancel={() => setShowForm(false)}
                    />
                )}
            </div>
        </div>
    );
};

function StatCard({ label, value, isPositive }) {
    return (
        <div style={{
            background: 'rgba(255,255,255,0.03)',
            padding: '8px',
            borderRadius: '4px',
            border: '1px solid var(--border-color)'
        }}>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginBottom: '2px' }}>{label}</div>
            <div style={{
                fontSize: '13px',
                fontFamily: 'var(--font-mono)',
                fontWeight: '600',
                color: isPositive !== undefined
                    ? (isPositive ? 'var(--accent-primary)' : 'var(--accent-danger)')
                    : '#fff'
            }}>
                {value}
            </div>
        </div>
    );
}

function PositionCard({ position, currentPrice, onClose, onDelete }) {
    const [showCloseForm, setShowCloseForm] = useState(false);
    const [exitPrice, setExitPrice] = useState(currentPrice?.toFixed(2) || position.entry);

    // Calculate unrealized P&L
    const currentPnL = currentPrice
        ? (position.side === 'long' ? 1 : -1) * (currentPrice - position.entry) * position.size
        : 0;
    const pnlPercent = ((currentPnL / (position.entry * position.size)) * 100).toFixed(2);

    return (
        <div style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '8px',
            position: 'relative'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>
                        {position.side === 'long' ? '📈' : '📉'} {position.symbol}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {new Date(position.openedAt).toLocaleDateString()}
                    </div>
                </div>
                <button
                    onClick={onDelete}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '2px'
                    }}
                >
                    <X size={14} />
                </button>
            </div>

            {/* Position details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px' }}>
                <div>
                    <span style={{ color: 'var(--text-muted)' }}>Entry:</span>{' '}
                    <span style={{ fontFamily: 'var(--font-mono)' }}>${position.entry.toFixed(2)}</span>
                </div>
                <div>
                    <span style={{ color: 'var(--text-muted)' }}>Size:</span>{' '}
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{position.size}</span>
                </div>
                <div>
                    <span style={{ color: 'var(--text-muted)' }}>Current:</span>{' '}
                    <span style={{ fontFamily: 'var(--font-mono)' }}>${currentPrice?.toFixed(2) || '--'}</span>
                </div>
                <div>
                    <span style={{ color: 'var(--text-muted)' }}>P&L:</span>{' '}
                    <span style={{
                        fontFamily: 'var(--font-mono)',
                        color: currentPnL >= 0 ? 'var(--accent-primary)' : 'var(--accent-danger)',
                        fontWeight: '600'
                    }}>
                        ${currentPnL.toFixed(2)} ({pnlPercent}%)
                    </span>
                </div>
            </div>

            {/* Close button */}
            {!showCloseForm ? (
                <button
                    onClick={() => setShowCloseForm(true)}
                    style={{
                        width: '100%',
                        marginTop: '10px',
                        padding: '6px',
                        background: currentPnL >= 0 ? 'var(--accent-primary)' : 'var(--accent-danger)',
                        border: 'none',
                        borderRadius: '4px',
                        color: currentPnL >= 0 ? '#000' : '#fff',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: 'pointer'
                    }}
                >
                    Close Position
                </button>
            ) : (
                <div style={{ marginTop: '10px' }}>
                    <input
                        type="number"
                        value={exitPrice}
                        onChange={(e) => setExitPrice(e.target.value)}
                        placeholder="Exit price"
                        style={{
                            width: '100%',
                            padding: '6px',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            color: '#fff',
                            fontSize: '12px',
                            fontFamily: 'var(--font-mono)',
                            marginBottom: '6px'
                        }}
                    />
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                            onClick={() => onClose(parseFloat(exitPrice))}
                            style={{
                                flex: 1,
                                padding: '6px',
                                background: 'var(--accent-primary)',
                                border: 'none',
                                borderRadius: '4px',
                                color: '#000',
                                fontSize: '11px',
                                fontWeight: '600',
                                cursor: 'pointer'
                            }}
                        >
                            Confirm Close
                        </button>
                        <button
                            onClick={() => setShowCloseForm(false)}
                            style={{
                                flex: 1,
                                padding: '6px',
                                background: 'rgba(255,255,255,0.1)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '4px',
                                color: 'var(--text-primary)',
                                fontSize: '11px',
                                cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function NewPositionForm({ symbol, currentPrice, onSubmit, onCancel }) {
    const [side, setSide] = useState('long');
    const [entry, setEntry] = useState(currentPrice?.toFixed(2) || '');
    const [size, setSize] = useState('');
    const [stopLoss, setStopLoss] = useState('');
    const [takeProfit, setTakeProfit] = useState('');

    const handleSubmit = () => {
        if (!entry || !size) return;
        onSubmit({
            symbol,
            side,
            entry: parseFloat(entry),
            size: parseFloat(size),
            stopLoss: stopLoss ? parseFloat(stopLoss) : null,
            takeProfit: takeProfit ? parseFloat(takeProfit) : null
        });
    };

    return (
        <div style={{
            background: 'rgba(0, 255, 157, 0.05)',
            border: '1px solid var(--accent-primary)',
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '8px'
        }}>
            <h4 style={{ fontSize: '12px', marginBottom: '10px', color: 'var(--accent-primary)' }}>
                New {symbol} Position
            </h4>

            {/* Side selection */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                {['long', 'short'].map(s => (
                    <button
                        key={s}
                        onClick={() => setSide(s)}
                        style={{
                            flex: 1,
                            padding: '8px',
                            background: side === s ? (s === 'long' ? 'var(--accent-primary)' : 'var(--accent-danger)') : 'rgba(255,255,255,0.05)',
                            border: '1px solid ' + (side === s ? 'transparent' : 'var(--border-color)'),
                            borderRadius: '4px',
                            color: side === s ? '#000' : 'var(--text-primary)',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            textTransform: 'uppercase'
                        }}
                    >
                        {s === 'long' ? '📈' : '📉'} {s}
                    </button>
                ))}
            </div>

            {/* Form fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                <input
                    type="number"
                    value={entry}
                    onChange={(e) => setEntry(e.target.value)}
                    placeholder="Entry price"
                    style={inputStyle}
                />
                <input
                    type="number"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    placeholder="Size (units)"
                    style={inputStyle}
                />
                <input
                    type="number"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(e.target.value)}
                    placeholder="Stop loss (optional)"
                    style={inputStyle}
                />
                <input
                    type="number"
                    value={takeProfit}
                    onChange={(e) => setTakeProfit(e.target.value)}
                    placeholder="Take profit (optional)"
                    style={inputStyle}
                />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleSubmit} style={{
                    flex: 1,
                    padding: '8px',
                    background: 'var(--accent-primary)',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#000',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer'
                }}>
                    Create Position
                </button>
                <button onClick={onCancel} style={{
                    flex: 1,
                    padding: '8px',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    cursor: 'pointer'
                }}>
                    Cancel
                </button>
            </div>
        </div>
    );
}

const inputStyle = {
    width: '100%',
    padding: '8px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--border-color)',
    borderRadius: '4px',
    color: '#fff',
    fontSize: '12px',
    fontFamily: 'var(--font-mono)'
};

export default PortfolioManager;
