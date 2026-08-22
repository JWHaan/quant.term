import React, { useEffect, useState, useRef } from 'react';
import { OFICalculator, OFIResult } from '@/utils/ofiCalculator';
import { useOrderBook } from '@/hooks/useOrderBook';

interface OFIIndicatorProps {
    symbol: string;
}

export const OFIIndicator: React.FC<OFIIndicatorProps> = ({ symbol }) => {
    const { bids, asks, isConnected } = useOrderBook(symbol);
    const [currentOFI, setCurrentOFI] = useState<OFIResult | null>(null);
    const [ofiMA, setOfiMA] = useState<number>(0);
    const [significantEvent, setSignificantEvent] = useState<{ type: 'buy' | 'sell' | null; magnitude: number }>({ type: null, magnitude: 0 });
    const calculatorRef = useRef<OFICalculator>(new OFICalculator());

    useEffect(() => {
        if (!bids.length || !asks.length) return;

        const snapshot = {
            bids,
            asks,
            timestamp: Date.now()
        };

        const result = calculatorRef.current.calculate(snapshot);
        if (result) {
            setCurrentOFI(result);
            setOfiMA(calculatorRef.current.getOFIMovingAverage(10));
            setSignificantEvent(calculatorRef.current.detectSignificantEvent());
        }
    }, [bids, asks]);

    useEffect(() => {
        // Reset calculator when symbol changes
        calculatorRef.current.reset();
    }, [symbol]);

    if (!currentOFI) {
        return (
            <div className="feed-init">
                [INITIALIZING_OFI]...
            </div>
        );
    }

    const getOFIColor = (ofi: number): string => {
        if (ofi > 0.3) return 'var(--accent-success)'; // Strong buy pressure
        if (ofi > 0.1) return 'var(--accent-success)'; // Moderate buy
        if (ofi < -0.3) return 'var(--accent-danger)'; // Strong sell pressure
        if (ofi < -0.1) return 'var(--accent-danger)'; // Moderate sell
        return 'var(--text-muted)'; // Neutral
    };

    const ofiPercent = Math.abs(currentOFI.ofi) * 100;
    const ofiColor = getOFIColor(currentOFI.ofi);

    return (
        <div className="signal-panel">
            {/* Header */}
            <div className="signal-head">
                <span className="signal-head__label">
                    DEPTH_FLOW_IMBALANCE · EXPERIMENTAL
                </span>
                <span className="signal-head__state" style={{ color: isConnected ? 'var(--accent-primary)' : 'var(--accent-danger)' }}>
                    {isConnected ? '[LIVE]' : '[OFFLINE]'}
                </span>
            </div>

            {/* OFI Value */}
            <div className="signal-hero">
                <span className="signal-hero__value tnum" style={{ color: ofiColor }}>
                    {currentOFI.ofi > 0 ? '+' : ''}{currentOFI.ofi.toFixed(3)}
                </span>
                <span className="signal-hero__pct tnum">
                    ({ofiPercent.toFixed(1)}%)
                </span>
            </div>

            {/* Visual Bar */}
            <div className="signal-meter signal-meter--thin">
                <div
                    className="signal-meter__fill"
                    style={{
                        left: currentOFI.ofi < 0 ? `${Math.max(0, 50 - ofiPercent)}%` : '50%',
                        width: `${Math.min(ofiPercent, 100)}%`,
                        background: ofiColor
                    }}
                />
                {/* Center marker */}
                <div className="signal-meter__center" />
            </div>

            {/* Details */}
            <div className="signal-grid">
                <div>
                    <span className="signal-kv__key">BID_PRESSURE:</span>
                    <span className="signal-kv__val tnum" style={{ color: 'var(--accent-success)' }}>
                        {currentOFI.bidPressure.toFixed(2)}
                    </span>
                </div>
                <div>
                    <span className="signal-kv__key">ASK_PRESSURE:</span>
                    <span className="signal-kv__val tnum" style={{ color: 'var(--accent-danger)' }}>
                        {currentOFI.askPressure.toFixed(2)}
                    </span>
                </div>
                <div>
                    <span className="signal-kv__key">MA(10):</span>
                    <span className="signal-kv__val tnum" style={{ color: 'var(--text-primary)' }}>
                        {ofiMA.toFixed(3)}
                    </span>
                </div>
                <div>
                    <span className="signal-kv__key">TOTAL_VOL:</span>
                    <span className="signal-kv__val tnum" style={{ color: 'var(--text-primary)' }}>
                        {currentOFI.totalVolume.toFixed(2)}
                    </span>
                </div>
            </div>

            {/* Significant Event Alert */}
            {significantEvent.type && (
                <div className={`signal-alert ${significantEvent.type === 'buy' ? 'signal-alert--buy' : 'signal-alert--sell'}`}>
                    {significantEvent.type.toUpperCase()}_IMBALANCE ({significantEvent.magnitude.toFixed(1)}σ)
                </div>
            )}
        </div>
    );
};
