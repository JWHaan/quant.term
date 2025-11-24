import React, { useState, useEffect } from 'react';
import { ArrowDown, ArrowUp, Info } from 'lucide-react';

interface OnChainMetric {
    value: number;
    status: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    description: string;
}

const OnChainPanel: React.FC = () => {
    const [mvrv, setMvrv] = useState<OnChainMetric>({ value: 1.2, status: 'NEUTRAL', description: 'Market Value to Realized Value' });
    const [nvt, setNvt] = useState<OnChainMetric>({ value: 45, status: 'NEUTRAL', description: 'Network Value to Transactions' });
    const [exchangeFlow, setExchangeFlow] = useState<number>(-1250); // Net BTC outflow

    // Mock Data Updates
    useEffect(() => {
        const interval = setInterval(() => {
            // Simulate live data changes
            setMvrv(prev => {
                const newVal = +(prev.value + (Math.random() - 0.5) * 0.05).toFixed(2);
                let status: OnChainMetric['status'] = 'NEUTRAL';
                if (newVal < 1.0) status = 'BULLISH'; // Undervalued
                if (newVal > 3.0) status = 'BEARISH'; // Overvalued
                return { ...prev, value: newVal, status };
            });

            setNvt(prev => {
                const newVal = +(prev.value + (Math.random() - 0.5) * 1).toFixed(1);
                return { ...prev, value: newVal };
            });

            setExchangeFlow(prev => prev + Math.floor((Math.random() - 0.5) * 100));
        }, 5000);

        return () => clearInterval(interval);
    }, []);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'BULLISH': return 'var(--accent-primary)';
            case 'BEARISH': return 'var(--accent-danger)';
            default: return 'var(--text-muted)';
        }
    };

    return (
        <div style={{ padding: '12px', height: '100%', overflowY: 'auto', fontFamily: 'var(--font-mono)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', letterSpacing: '1px' }}>
                ON-CHAIN ANALYTICS (BTC)
            </div>

            {/* MVRV Ratio */}
            <div style={{ marginBottom: '16px', background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 'bold' }}>MVRV Ratio</span>
                        <div title="MVRV < 1.0: Undervalued (Buy) | MVRV > 3.0: Overvalued (Sell)">
                            <Info size={12} color="var(--text-muted)" style={{ cursor: 'help' }} />
                        </div>
                    </div>
                    <span style={{
                        fontSize: '16px',
                        fontWeight: 'bold',
                        color: getStatusColor(mvrv.status)
                    }}>
                        {mvrv.value.toFixed(2)}
                    </span>
                </div>

                {/* MVRV Gauge Visualization */}
                <div style={{ position: 'relative', height: '6px', background: '#333', borderRadius: '3px', marginTop: '8px' }}>
                    {/* Zones */}
                    <div style={{ position: 'absolute', left: '0%', width: '25%', height: '100%', background: 'var(--accent-primary)', opacity: 0.3, borderRadius: '3px 0 0 3px' }} title="Undervalued (<1.0)" />
                    <div style={{ position: 'absolute', left: '75%', width: '25%', height: '100%', background: 'var(--accent-danger)', opacity: 0.3, borderRadius: '0 3px 3px 0' }} title="Overvalued (>3.0)" />

                    {/* Indicator */}
                    <div style={{
                        position: 'absolute',
                        left: `${Math.min(100, Math.max(0, (mvrv.value / 4) * 100))}%`,
                        top: '-3px',
                        width: '2px',
                        height: '12px',
                        background: '#fff',
                        boxShadow: '0 0 4px #fff'
                    }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    <span>0.0</span>
                    <span>1.0 (Fair)</span>
                    <span>3.0 (Top)</span>
                    <span>4.0</span>
                </div>
            </div>

            {/* NVT Ratio */}
            <div style={{ marginBottom: '16px', background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>NVT Ratio (PE)</div>
                        <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{nvt.value.toFixed(1)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Signal</div>
                        <div style={{ color: nvt.value < 30 ? 'var(--accent-primary)' : nvt.value > 90 ? 'var(--accent-danger)' : 'var(--text-muted)' }}>
                            {nvt.value < 30 ? 'UNDERVALUED' : nvt.value > 90 ? 'OVERVALUED' : 'FAIR VALUE'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Exchange Net Flow */}
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '4px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Exchange Net Flow (24h)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {exchangeFlow < 0 ?
                        <ArrowDown size={20} color="var(--accent-primary)" /> :
                        <ArrowUp size={20} color="var(--accent-danger)" />
                    }
                    <div>
                        <div style={{
                            fontSize: '18px',
                            fontWeight: 'bold',
                            color: exchangeFlow < 0 ? 'var(--accent-primary)' : 'var(--accent-danger)'
                        }}>
                            {Math.abs(exchangeFlow).toLocaleString()} BTC
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            {exchangeFlow < 0 ? 'Outflow (Accumulation)' : 'Inflow (Selling Pressure)'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OnChainPanel;
