import React, { useState } from 'react';
import { X } from 'lucide-react';

interface Position {
    id: string;
    symbol: string;
    side: 'long' | 'short';
    entry: number;
    size: number;
    openedAt: number;
}

interface PositionCardProps {
    position: Position;
    currentPrice?: number | undefined;
    onClose: (exitPrice: number) => void;
    onDelete: () => void;
}

export const PositionCard: React.FC<PositionCardProps> = ({ position, currentPrice, onClose, onDelete }) => {
    const [showCloseForm, setShowCloseForm] = useState(false);
    const [exitPrice, setExitPrice] = useState(currentPrice?.toFixed(2) || position.entry.toString());

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
};
