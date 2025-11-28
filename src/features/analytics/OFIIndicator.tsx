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
                fontSize: '10px',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)'
            }}>
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
        <div style={{
            padding: '8px',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-subtle)',
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
                    &gt; ORDER_FLOW_IMBALANCE
                </span>
                <span style={{
                    fontSize: '8px',
                    color: isConnected ? 'var(--accent-primary)' : 'var(--accent-danger)'
                }}>
                    {isConnected ? '[LIVE]' : '[OFFLINE]'}
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
                    fontWeight: 'bold',
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
                background: '#000',
                border: '1px solid var(--border-subtle)',
                marginBottom: '8px',
                position: 'relative'
            }}>
                <div style={{
                    height: '100%',
                    width: `${Math.min(ofiPercent, 100)}%`,
                    background: ofiColor,
                    transition: 'width 0.2s, background 0.2s',
                    marginLeft: currentOFI.ofi < 0 ? `${Math.max(0, 50 - ofiPercent)}%` : '50%',
                    position: 'absolute'
                }} />
                {/* Center marker */}
                <div style={{
                    position: 'absolute',
                    left: '50%',
                    top: 0,
                    bottom: 0,
                    width: '1px',
                    background: 'var(--text-muted)'
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
                    <span style={{ color: 'var(--text-muted)' }}>BID_PRESSURE:</span>
                    <span style={{ color: 'var(--accent-success)', marginLeft: '4px' }}>
                        {currentOFI.bidPressure.toFixed(2)}
                    </span>
                </div>
                <div>
                    <span style={{ color: 'var(--text-muted)' }}>ASK_PRESSURE:</span>
                    <span style={{ color: 'var(--accent-danger)', marginLeft: '4px' }}>
                        {currentOFI.askPressure.toFixed(2)}
                    </span>
                </div>
                <div>
                    <span style={{ color: 'var(--text-muted)' }}>MA(10):</span>
                    <span style={{ marginLeft: '4px', color: 'var(--text-primary)' }}>
                        {ofiMA.toFixed(3)}
                    </span>
                </div>
                <div>
                    <span style={{ color: 'var(--text-muted)' }}>TOTAL_VOL:</span>
                    <span style={{ marginLeft: '4px', color: 'var(--text-primary)' }}>
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
                        ? 'rgba(51, 255, 0, 0.1)'
                        : 'rgba(255, 0, 0, 0.1)',
                    border: `1px solid ${significantEvent.type === 'buy' ? 'var(--accent-success)' : 'var(--accent-danger)'}`,
                    fontSize: '9px',
                    color: significantEvent.type === 'buy' ? 'var(--accent-success)' : 'var(--accent-danger)',
                    textAlign: 'center'
                }}>
                    &gt;&gt; {significantEvent.type.toUpperCase()}_SIGNAL ({significantEvent.magnitude.toFixed(1)}σ)
                </div>
            )}
        </div>
    );
};
