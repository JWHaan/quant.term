import React from 'react';

interface StatCardProps {
    label: string;
    value: string | number;
    isPositive?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, isPositive }) => {
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
};
