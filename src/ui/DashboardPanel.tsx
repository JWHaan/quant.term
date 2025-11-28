import React from 'react';

interface DashboardPanelProps {
    title: string;
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
}

const DashboardPanel: React.FC<DashboardPanelProps> = ({ title, children, className = '', style = {} }) => {
    return (
        <div
            className={`dashboard-panel ${className}`}
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-color)',
                overflow: 'hidden',
                position: 'relative',
                boxShadow: '0 0 10px rgba(51, 255, 0, 0.05)',
                ...style
            }}
        >
            {/* Hacker Terminal Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0 4px',
                height: '24px',
                background: 'rgba(51, 255, 0, 0.1)',
                borderBottom: '1px solid var(--border-color)',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--accent-primary)',
                textTransform: 'uppercase',
                flexShrink: 0,
                userSelect: 'none'
            }}>
                <span style={{ marginRight: '8px', opacity: 0.7 }}>//</span>
                <span style={{ fontWeight: 'bold', letterSpacing: '1px' }}>
                    {title}
                </span>
                <span className="cursor-blink" style={{ marginLeft: '2px' }}></span>

                <div style={{ flex: 1, height: '1px', background: 'var(--border-color)', marginLeft: '12px', opacity: 0.5 }}></div>

                <div style={{ marginLeft: '8px', display: 'flex', gap: '4px' }}>
                    <span>[</span>
                    <span style={{ color: 'var(--accent-warning)' }}>R</span>
                    <span style={{ color: 'var(--accent-danger)' }}>W</span>
                    <span style={{ color: 'var(--accent-success)' }}>X</span>
                    <span>]</span>
                </div>
            </div>

            {/* Content */}
            <div style={{
                flex: 1,
                overflow: 'hidden',
                position: 'relative',
                background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(51,255,0,0.02) 100%)'
            }}>
                {children}
            </div>

            {/* Corner Decorations */}
            <div style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: '8px',
                height: '8px',
                borderRight: '2px solid var(--border-color)',
                borderBottom: '2px solid var(--border-color)',
                pointerEvents: 'none'
            }} />
            <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                width: '8px',
                height: '8px',
                borderLeft: '2px solid var(--border-color)',
                borderBottom: '2px solid var(--border-color)',
                pointerEvents: 'none'
            }} />
        </div>
    );
};

export default DashboardPanel;
