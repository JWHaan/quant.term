import { useState, forwardRef, useImperativeHandle } from 'react';

interface OnChainFeedProps {
    symbol: string;
}

interface OnChainAlert {
    id: number;
    time: string;
    type: 'INFLOW' | 'OUTFLOW';
    value: number;
    wallet: string;
    coin: string;
}

const OnChainFeed = forwardRef<any, OnChainFeedProps>(({ symbol }, ref) => {
    const [alerts, setAlerts] = useState<OnChainAlert[]>([]);

    useImperativeHandle(ref, () => ({
        addAlert: (trade: any) => {
            const value = trade.p * trade.q;
            const type = trade.m ? 'SELL' : 'BUY'; // m=true is buyer maker (sell)
            const newAlert = {
                id: Date.now(),
                time: new Date(trade.T).toLocaleTimeString(),
                type: (type === 'BUY' ? 'INFLOW' : 'OUTFLOW') as 'INFLOW' | 'OUTFLOW',
                value: value,
                wallet: type === 'BUY' ? 'Exchange -> Wallet' : 'Wallet -> Exchange',
                coin: symbol.toUpperCase()
            };
            setAlerts(prev => [newAlert, ...prev].slice(0, 20));
        }
    }));

    return (
        <div style={{ height: '100%', overflowY: 'auto', padding: '4px' }}>
            {alerts.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                    Waiting for Whale Activity (&gt; $50k)...
                </div>
            )}
            {alerts.map(alert => (
                <div key={alert.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px',
                    borderBottom: '1px solid var(--border-color)',
                    fontSize: '11px',
                    animation: 'fadeIn 0.3s ease-in'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 'bold', color: alert.type === 'INFLOW' ? '#00ff9d' : '#ff0055' }}>
                            {alert.type}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{alert.wallet}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span style={{ fontWeight: 'bold', color: '#fff' }}>
                            ${alert.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{alert.time}</span>
                    </div>
                </div>
            ))}
            <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
        </div>
    );
});

export default OnChainFeed;
