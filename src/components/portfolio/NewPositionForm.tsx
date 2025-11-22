import React, { useState } from 'react';

interface PositionData {
    symbol: string;
    side: 'long' | 'short';
    entry: number;
    size: number;
    stopLoss: number | null;
    takeProfit: number | null;
}

interface NewPositionFormProps {
    symbol: string;
    currentPrice?: number | undefined;
    onSubmit: (position: PositionData) => void;
    onCancel: () => void;
}

export const NewPositionForm: React.FC<NewPositionFormProps> = ({ symbol, currentPrice, onSubmit, onCancel }) => {
    const [side, setSide] = useState<'long' | 'short'>('long');
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

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '8px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid var(--border-color)',
        borderRadius: '4px',
        color: '#fff',
        fontSize: '12px',
        fontFamily: 'var(--font-mono)'
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
                {(['long', 'short'] as const).map(s => (
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
};
