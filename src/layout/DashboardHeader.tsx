import React, { useState, useEffect } from 'react';
import { Wifi, Clock, Globe } from 'lucide-react';

interface DashboardHeaderProps {
    symbol: string;
    setSymbol: (symbol: string) => void;
    view: string;
    setView: (view: string) => void;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ symbol, setSymbol, view, setView }) => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <header style={{
            height: '60px',
            backgroundColor: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 var(--spacing-lg)',
            gridArea: 'header'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-lg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Globe size={20} color="var(--accent-primary)" />
                    <span className="mono" style={{ fontWeight: 'bold', fontSize: '18px', letterSpacing: '1px' }}>QUANT.TERM</span>
                </div>

                <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }}></div>

                <div style={{ display: 'flex', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', padding: '2px' }}>
                    <button
                        onClick={() => setView('MARKET')}
                        style={{
                            background: view === 'MARKET' ? 'var(--bg-secondary)' : 'transparent',
                            color: view === 'MARKET' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            border: 'none',
                            borderRadius: '2px',
                            padding: '4px 12px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        MARKET
                    </button>
                    <button
                        onClick={() => setView('RISK')}
                        style={{
                            background: view === 'RISK' ? 'var(--bg-secondary)' : 'transparent',
                            color: view === 'RISK' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            border: 'none',
                            borderRadius: '2px',
                            padding: '4px 12px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        RISK
                    </button>
                </div>

                <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }}></div>

                <select
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    style={{
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-color)',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '14px',
                        outline: 'none',
                        cursor: 'pointer',
                        minWidth: '150px'
                    }}
                >
                    <option value="btcusdt">BTC/USDT</option>
                    <option value="ethusdt">ETH/USDT</option>
                    <option value="solusdt">SOL/USDT</option>
                    <option value="bnbusdt">BNB/USDT</option>
                    <option value="dogeusdt">DOGE/USDT</option>
                </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-lg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <Clock size={14} />
                    <span className="mono">{time.toLocaleTimeString()}</span>
                </div>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    color: 'var(--accent-primary)',
                    backgroundColor: 'rgba(0, 255, 157, 0.1)',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1px solid rgba(0, 255, 157, 0.2)'
                }}>
                    <Wifi size={14} />
                    <span className="mono">CONNECTED</span>
                </div>
            </div>
        </header>
    );
};

export default DashboardHeader;
