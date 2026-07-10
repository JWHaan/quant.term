import React from 'react';
import { formatLatency, formatUTCTime } from '@/utils/format';
import { LATENCY_THRESHOLDS } from '@/constants/config';

function getQualityColor(quality: string): string {
    switch (quality) {
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
}) => (
    <footer className="app-footer">
        <div className="status-item">
            <span className="label">LATENCY</span>
            <span className="value" style={{ color: latency ? getQualityColor(quality) : 'var(--text-muted)' }}>
                {formatLatency(latency, quality)}
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
            <span className="value">UTC {formatUTCTime()}</span>
        </div>
    </footer>
);

export default AppFooter;
