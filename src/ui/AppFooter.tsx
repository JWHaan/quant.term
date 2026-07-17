import React from 'react';
import { formatLatency, formatUTCTime } from '@/utils/format';

interface AppFooterProps {
    latency: number | null;
    quality: string;
    updatesPerSecond: number;
    isGlobalConnected: boolean;
    selectedSymbol: string;
}

function getQualityClass(quality: string, latency: number | null): string {
    if (latency === null) return 'quality-offline';

    switch (quality.toLowerCase()) {
        case 'excellent': return 'quality-excellent';
        case 'good': return 'quality-good';
        case 'fair': return 'quality-fair';
        case 'poor': return 'quality-poor';
        default: return '';
    }
}

const AppFooter: React.FC<AppFooterProps> = ({
    latency,
    quality,
    updatesPerSecond,
    isGlobalConnected,
    selectedSymbol
}) => {
    const connectionState = isGlobalConnected ? 'connected' : 'offline';
    const qualityClass = getQualityClass(quality, latency);

    return (
        <footer className="app-footer" aria-label="Market data status">
            <div
                className="status-item status-item--connection"
                data-state={connectionState}
                role="status"
                aria-live="polite"
                aria-atomic="true"
            >
                <span className="status-dot" aria-hidden="true" />
                <span className="label">FEED</span>
                <span className="value">{isGlobalConnected ? 'CONNECTED' : 'DISCONNECTED'}</span>
            </div>

            <div className="status-item status-item--exchange">
                <span className="label">VENUE</span>
                <span className="value">BINANCE SPOT + USDⓈ-M</span>
            </div>

            <div className="status-item status-item--symbol">
                <span className="label">INSTRUMENT</span>
                <span className="value">{selectedSymbol}</span>
            </div>

            <div className="status-item" title={`Connection quality: ${quality}`}>
                <span className="label">LATENCY</span>
                <span className={`value ${qualityClass}`.trim()}>
                    {formatLatency(latency, quality)}
                </span>
            </div>

            <div className="status-item status-item--rate">
                <span className="label">RATE</span>
                <span className="value">{updatesPerSecond} MSG/S</span>
            </div>

            <div className="status-item right">
                <span className="label">UTC</span>
                <time className="value">{formatUTCTime()}</time>
            </div>
        </footer>
    );
};

export default AppFooter;
