import React from 'react';
import type { BacktestResult } from '@/backtest/types';

interface StrategyFooterProps {
    result: BacktestResult | null;
}

const StrategyFooter: React.FC<StrategyFooterProps> = ({ result }) => (
    <footer className="app-footer" aria-label="Backtest engine status">
        <div
            className="status-item status-item--connection"
            data-state="connected"
            role="status"
            aria-live="polite"
        >
            <span className="status-dot" aria-hidden="true" />
            <span className="label">ENGINE</span>
            <span className="value">DETERMINISTIC</span>
        </div>
        <div className="status-item">
            <span className="label">CONTRACT</span>
            <span className="value">BACKTEST-V1</span>
        </div>
        <div className="status-item status-item--symbol">
            <span className="label">INSTRUMENT</span>
            <span className="value">BTCUSDT · 1M</span>
        </div>
        <div className="status-item">
            <span className="label">DATASET</span>
            <span className="value">SYNTHETIC FIXTURE · 480 CANDLES</span>
        </div>
        <div className="status-item right">
            <span className="label">LAST RUN</span>
            <span className="value">{result ? result.dataset.checksum.slice(-8).toUpperCase() : 'NOT RUN'}</span>
        </div>
    </footer>
);

export default StrategyFooter;
