import React, { useEffect, useState, useRef } from 'react';
import { useMarketStore } from '@/stores/marketStore';
import { calculateOFI } from '@/utils/indicators';
import { AlertTriangle, ShieldCheck, ShieldAlert } from 'lucide-react';

interface Trade {
    price: number;
    quantity: number;
    isBuyerMaker: boolean; // true = Sell, false = Buy
}

interface VPINBucket {
    buyVolume: number;
    sellVolume: number;
    totalVolume: number;
}

const OrderFlowImbalance: React.FC = () => {
    const { selectedSymbol } = useMarketStore();
    const [imbalance, setImbalance] = useState(0); // -1 to 1
    const [volumeDelta, setVolumeDelta] = useState(0);
    const [history, setHistory] = useState<{ time: number; val: number }[]>([]);

    // VPIN State
    const [vpin, setVpin] = useState(0.25); // Initial safe value
    const [toxicity, setToxicity] = useState<'NORMAL' | 'HIGH' | 'CRITICAL'>('NORMAL');

    const wsRef = useRef<WebSocket | null>(null);
    const vpinBucketsRef = useRef<VPINBucket[]>([]);
    const currentBucketRef = useRef<VPINBucket>({ buyVolume: 0, sellVolume: 0, totalVolume: 0 });

    // Config
    const BUCKET_VOLUME_SIZE = 50; // Volume threshold to close a bucket (e.g., 50 BTC)
    const VPIN_WINDOW = 10; // Number of buckets for VPIN calculation

    // Connect to Trade Stream for Real-Time OFI
    useEffect(() => {
        const symbolLower = selectedSymbol.toLowerCase();
        const ws = new WebSocket(`wss://fstream.binance.com/ws/${symbolLower}@aggTrade`);
        wsRef.current = ws;

        let tradeBuffer: Trade[] = [];

        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            const trade: Trade = {
                price: parseFloat(msg.p),
                quantity: parseFloat(msg.q),
                isBuyerMaker: msg.m // true = Sell, false = Buy
            };

            tradeBuffer.push(trade);

            // Update VPIN Bucket
            const isSell = trade.isBuyerMaker;
            if (isSell) {
                currentBucketRef.current.sellVolume += trade.quantity;
            } else {
                currentBucketRef.current.buyVolume += trade.quantity;
            }
            currentBucketRef.current.totalVolume += trade.quantity;

            // Check if bucket is full
            if (currentBucketRef.current.totalVolume >= BUCKET_VOLUME_SIZE) {
                // Push to history
                vpinBucketsRef.current.push({ ...currentBucketRef.current });
                if (vpinBucketsRef.current.length > VPIN_WINDOW) {
                    vpinBucketsRef.current.shift();
                }

                // Calculate VPIN
                // VPIN = Sum(|V_buy - V_sell|) / Sum(V_total)
                let totalDiff = 0;
                let totalVol = 0;

                vpinBucketsRef.current.forEach(b => {
                    totalDiff += Math.abs(b.buyVolume - b.sellVolume);
                    totalVol += b.totalVolume;
                });

                if (totalVol > 0) {
                    const newVpin = totalDiff / totalVol;
                    setVpin(newVpin);

                    if (newVpin > 0.8) setToxicity('CRITICAL');
                    else if (newVpin > 0.6) setToxicity('HIGH');
                    else setToxicity('NORMAL');
                }

                // Reset current bucket (carry over excess? For simplicity, just reset)
                currentBucketRef.current = { buyVolume: 0, sellVolume: 0, totalVolume: 0 };
            }
        };

        // Process buffer every 100ms to update UI (OFI)
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

    const getToxicityColor = (level: string) => {
        switch (level) {
            case 'CRITICAL': return 'var(--accent-danger)';
            case 'HIGH': return '#FFA500';
            default: return 'var(--accent-primary)';
        }
    };

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

            {/* VPIN Toxicity Gauge */}
            <div style={{ marginBottom: '12px', background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>FLOW TOXICITY (VPIN)</span>
                        {toxicity === 'CRITICAL' ? <ShieldAlert size={12} color="var(--accent-danger)" /> :
                            toxicity === 'HIGH' ? <AlertTriangle size={12} color="#FFA500" /> :
                                <ShieldCheck size={12} color="var(--accent-primary)" />}
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: getToxicityColor(toxicity) }}>
                        {vpin.toFixed(2)} ({toxicity})
                    </span>
                </div>

                {/* VPIN Bar */}
                <div style={{ width: '100%', height: '4px', background: '#333', borderRadius: '2px', position: 'relative' }}>
                    <div style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${Math.min(100, vpin * 100)}%`,
                        background: getToxicityColor(toxicity),
                        borderRadius: '2px',
                        transition: 'width 0.5s ease'
                    }} />
                    {/* Threshold Markers */}
                    <div style={{ position: 'absolute', left: '60%', top: '-2px', bottom: '-2px', width: '1px', background: '#666' }} title="High (0.6)" />
                    <div style={{ position: 'absolute', left: '80%', top: '-2px', bottom: '-2px', width: '1px', background: '#666' }} title="Critical (0.8)" />
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
