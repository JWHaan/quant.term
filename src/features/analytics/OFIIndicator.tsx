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
            <div style={{
                padding: '8px',
                background: 'rgba(0,0,0,0.5)',
                borderRadius: '4px',
                fontSize: '10px',
                color: 'var(--text-muted)'
            }}>
                Initializing OFI...
            </div>
        );
    }

    const getOFIColor = (ofi: number): string => {
        if (ofi > 0.3) return '#00ff9d'; // Strong buy pressure
        if (ofi > 0.1) return '#4CAF50'; // Moderate buy
        if (ofi < -0.3) return '#ff3b30'; // Strong sell pressure
        if (ofi < -0.1) return '#FF6B6B'; // Moderate sell
        return '#888'; // Neutral
    };

    const ofiPercent = Math.abs(currentOFI.ofi) * 100;
    const ofiColor = getOFIColor(currentOFI.ofi);

    return (
        <div style={{
            padding: '8px',
            background: 'rgba(0,0,0,0.8)',
            borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.1)',
            fontFamily: 'var(--font-mono)'
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px'
            }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    ORDER FLOW IMBALANCE
                </span>
                <span style={{
                    fontSize: '8px',
                    color: isConnected ? 'var(--accent-primary)' : 'var(--accent-danger)'
                }}>
                    {isConnected ? '● LIVE' : '○ OFFLINE'}
                </span>
            </div>

            {/* OFI Value */}
            <div style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '8px',
                marginBottom: '8px'
            }}>
                <span style={{
                    fontSize: '20px',
                    fontWeight: '600',
                    color: ofiColor
                }}>
                    {currentOFI.ofi > 0 ? '+' : ''}{currentOFI.ofi.toFixed(3)}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    ({ofiPercent.toFixed(1)}%)
                </span>
            </div>

            {/* Visual Bar */}
            <div style={{
                height: '4px',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '2px',
                overflow: 'hidden',
                marginBottom: '8px'
            }}>
                <div style={{
                    height: '100%',
                    width: `${ofiPercent}%`,
                    background: ofiColor,
                    transition: 'width 0.2s, background 0.2s',
                    marginLeft: currentOFI.ofi < 0 ? `${100 - ofiPercent}%` : '0'
                }} />
            </div>

            {/* Details */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '4px',
                fontSize: '9px',
                color: 'var(--text-secondary)'
            }}>
                <div>
                    <span style={{ color: 'var(--text-muted)' }}>Bid Pressure:</span>
                    <span style={{ color: '#00ff9d', marginLeft: '4px' }}>
                        {currentOFI.bidPressure.toFixed(2)}
                    </span>
                </div>
                <div>
                    <span style={{ color: 'var(--text-muted)' }}>Ask Pressure:</span>
                    <span style={{ color: '#ff3b30', marginLeft: '4px' }}>
                        {currentOFI.askPressure.toFixed(2)}
                    </span>
                </div>
                <div>
                    <span style={{ color: 'var(--text-muted)' }}>MA(10):</span>
                    <span style={{ marginLeft: '4px' }}>
                        {ofiMA.toFixed(3)}
                    </span>
                </div>
                <div>
                    <span style={{ color: 'var(--text-muted)' }}>Total Vol:</span>
                    <span style={{ marginLeft: '4px' }}>
                        {currentOFI.totalVolume.toFixed(2)}
                    </span>
                </div>
            </div>

            {/* Significant Event Alert */}
            {significantEvent.type && (
                <div style={{
                    marginTop: '8px',
                    padding: '4px 6px',
                    background: significantEvent.type === 'buy'
                        ? 'rgba(0, 255, 157, 0.1)'
                        : 'rgba(255, 59, 48, 0.1)',
                    border: `1px solid ${significantEvent.type === 'buy' ? '#00ff9d' : '#ff3b30'}`,
                    borderRadius: '2px',
                    fontSize: '9px',
                    color: significantEvent.type === 'buy' ? '#00ff9d' : '#ff3b30',
                    textAlign: 'center'
                }}>
                    ⚡ {significantEvent.type.toUpperCase()} SIGNAL ({significantEvent.magnitude.toFixed(1)}σ)
                </div>
            )}
        </div>
    );
};
