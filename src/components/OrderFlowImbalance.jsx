import React, { useEffect, useState, useRef } from 'react';
import { useMarketStore } from '@/stores/marketStore';
import { calculateOFI } from '@/utils/indicators';

const OrderFlowImbalance = () => {
    const { selectedSymbol } = useMarketStore();
    const [imbalance, setImbalance] = useState(0); // -1 to 1
    const [volumeDelta, setVolumeDelta] = useState(0);
    const [history, setHistory] = useState([]);
    const wsRef = useRef(null);

    // Connect to Trade Stream for Real-Time OFI
    useEffect(() => {
        const symbolLower = selectedSymbol.toLowerCase();
        const ws = new WebSocket(`wss://fstream.binance.com/ws/${symbolLower}@aggTrade`);
        wsRef.current = ws;

        let tradeBuffer = [];

        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            // Aggregate trades
            tradeBuffer.push({
                price: parseFloat(msg.p),
                quantity: parseFloat(msg.q),
                isBuyerMaker: msg.m // true = Sell, false = Buy
            });
        };

        // Process buffer every 100ms to update UI
        const interval = setInterval(() => {
            if (tradeBuffer.length === 0) return;

            const { netVolume, imbalanceRatio } = calculateOFI(tradeBuffer);

            setVolumeDelta(prev => prev + netVolume);
            setImbalance(imbalanceRatio);

            setHistory(prev => {
                const newItem = { time: Date.now(), val: imbalanceRatio };
                const newHistory = [...prev, newItem];
                if (newHistory.length > 50) newHistory.shift();
                return newHistory;
            });

            tradeBuffer = []; // Clear buffer
        }, 500);

        return () => {
            clearInterval(interval);
            if (wsRef.current) wsRef.current.close();
        };
    }, [selectedSymbol]);

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '12px', fontFamily: 'var(--font-mono)' }}>

            {/* Header Stats */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>IMBALANCE (OFI)</div>
                    <div style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: imbalance > 0 ? 'var(--accent-primary)' : 'var(--accent-danger)'
                    }}>
                        {(imbalance * 100).toFixed(1)}%
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>CVD (SESSION)</div>
                    <div style={{
                        fontSize: '14px',
                        color: volumeDelta > 0 ? 'var(--accent-primary)' : 'var(--accent-danger)'
                    }}>
                        {volumeDelta > 0 ? '+' : ''}{volumeDelta.toFixed(2)}
                    </div>
                </div>
            </div>

            {/* Visual Gauge Bar */}
            <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#666', marginBottom: '4px' }}>
                    <span>SELL PRESSURE</span>
                    <span>BUY PRESSURE</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#111', border: '1px solid #333', position: 'relative', overflow: 'hidden' }}>
                    {/* Center Line */}
                    <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', background: '#555', zIndex: 10 }} />

                    {/* Bar */}
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: imbalance > 0 ? '50%' : `${50 + (imbalance * 50)}%`,
                        width: `${Math.abs(imbalance * 50)}%`,
                        background: imbalance > 0 ? 'var(--accent-primary)' : 'var(--accent-danger)',
                        transition: 'all 0.3s ease-out'
                    }} />
                </div>
            </div>

            {/* History Histogram (Mini) */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '2px', opacity: 0.8 }}>
                {history.map((item, i) => (
                    <div key={item.time} style={{
                        flex: 1,
                        height: `${Math.abs(item.val) * 100}%`,
                        background: item.val > 0 ? 'var(--accent-primary)' : 'var(--accent-danger)',
                        minHeight: '1px',
                        opacity: i === history.length - 1 ? 1 : 0.5
                    }} />
                ))}
            </div>
        </div>
    );
};

export default React.memo(OrderFlowImbalance);
