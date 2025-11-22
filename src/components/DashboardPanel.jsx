import React from 'react';

const DashboardPanel = ({ title, children, className = '', style = {} }) => {
    return (
        <div
            className={`dashboard-panel ${className}`}
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                background: '#000',
                border: '1px solid var(--border-color)',
                overflow: 'hidden',
                ...style
            }}
        >
            {/* Bloomberg-style Header */}
            <div style={{
                padding: '4px 8px',
                borderBottom: '1px solid var(--border-color)',
                background: 'rgba(255, 128, 0, 0.05)',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                fontWeight: 'bold',
                color: 'var(--accent-primary)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                flexShrink: 0
            }}>
                <span style={{ color: 'var(--text-muted)' }}>[ </span>
                {title}
                <span style={{ color: 'var(--text-muted)' }}> ]</span>
            </div>

            {/* Content */}
            <div style={{
                flex: 1,
                overflow: 'hidden',
                position: 'relative'
            }}>
                {children}
            </div>
        </div>
    );
};

export default DashboardPanel;
