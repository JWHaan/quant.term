import React from 'react';
import PerformancePanel from '../features/trading/PerformancePanel';

function getQualityColor(q: string): string {
    switch (q) {
        case 'Excellent': return 'var(--accent-primary)';
        case 'Good': return '#FFD700';
        case 'Fair': return '#FFA500';
        case 'Poor': return 'var(--accent-danger)';
        default: return 'var(--text-muted)';
    }
}

interface AppFooterProps {
    latency: number | null;
    quality: string;
    updatesPerSecond: number;
    isGlobalConnected: boolean;
    selectedSymbol: string;
}

const AppFooter: React.FC<AppFooterProps> = ({
    latency,
    quality,
    updatesPerSecond,
    isGlobalConnected,
    selectedSymbol
}) => {
    const latencyDisplay = latency === null || latency === 0
        ? '—'
        : `${latency}ms (${quality})`;

    return (
        <footer className="app-footer">
            <div className="status-item">
                <span className="label">LATENCY</span>
                <span className="value" style={{ color: latency ? getQualityColor(quality) : 'var(--text-muted)' }}>
                    {latencyDisplay}
                </span>
            </div>
            <div className="status-item">
                <span className="label">DATA RATE</span>
                <span className="value">{updatesPerSecond} msg/s</span>
            </div>
            <div className="status-item">
                <span className="label">STATUS</span>
                <span className="value" style={{ color: isGlobalConnected ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                    {isGlobalConnected ? 'CONNECTED' : 'DISCONNECTED'}
                </span>
            </div>
            <div className="status-item">
                <span className="label">EXCHANGE</span>
                <span className="value">BINANCE FUTURES</span>
            </div>
            <div className="status-item">
                <span className="label">SYMBOL</span>
                <span className="value">{selectedSymbol}</span>
            </div>
            <div className="status-item right">
                <span className="value">UTC {new Date().toISOString().slice(11, 19)}</span>
            </div>
            {import.meta.env.DEV && <PerformancePanel />}
        </footer>
    );
};

export default AppFooter;
