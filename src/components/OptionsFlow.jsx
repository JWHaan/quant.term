import React, { useEffect, useState, useRef } from 'react';
import { deribitService } from '../services/deribitService';
import { ArrowUpRight, ArrowDownRight, Filter } from 'lucide-react';

const OptionsFlow = () => {
    const [trades, setTrades] = useState([]);
    const [stats, setStats] = useState({ calls: 0, puts: 0, volume: 0 });
    const listRef = useRef(null);

    useEffect(() => {
        const handleTrade = (data) => {
            // data is an array of trades
            const newTrades = data.map(t => ({
                id: t.trade_id,
                instrument: t.instrument_name,
                price: t.price,
                amount: t.amount,
                direction: t.direction, // buy/sell
                timestamp: t.timestamp,
                iv: t.iv,
                index_price: t.index_price,
                type: t.instrument_name.split('-').pop()[0] === 'C' ? 'Call' : 'Put'
            }));

            setTrades(prev => {
                const updated = [...newTrades, ...prev].slice(0, 50);
                return updated;
            });

            // Update Stats
            setStats(prev => {
                const newCalls = newTrades.filter(t => t.type === 'Call').length;
                const newPuts = newTrades.filter(t => t.type === 'Put').length;
                const newVol = newTrades.reduce((acc, t) => acc + (t.amount * t.index_price), 0);

                return {
                    calls: prev.calls + newCalls,
                    puts: prev.puts + newPuts,
                    volume: prev.volume + newVol
                };
            });
        };

        const unsubscribe = deribitService.subscribeToUpdates(handleTrade);
        return () => unsubscribe();
    }, []);

    const getStrike = (instrument) => {
        const parts = instrument.split('-');
        return parts[2];
    };

    const getExpiry = (instrument) => {
        const parts = instrument.split('-');
        return parts[1];
    };

    const pcr = stats.calls > 0 ? (stats.puts / stats.calls).toFixed(2) : '0.00';

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#000', fontSize: '11px' }}>
            {/* Header Stats */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.02)'
            }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <div>
                        <span style={{ color: 'var(--text-muted)', marginRight: '4px' }}>PCR:</span>
                        <span style={{
                            color: parseFloat(pcr) > 1 ? 'var(--accent-danger)' : 'var(--accent-primary)',
                            fontWeight: 'bold'
                        }}>{pcr}</span>
                    </div>
                    <div>
                        <span style={{ color: 'var(--text-muted)', marginRight: '4px' }}>Vol:</span>
                        <span style={{ color: '#fff' }}>${(stats.volume / 1000000).toFixed(1)}M</span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ color: 'var(--accent-primary)' }}>C: {stats.calls}</span>
                    <span style={{ color: 'var(--accent-danger)' }}>P: {stats.puts}</span>
                </div>
            </div>

            {/* Column Headers */}
            <div style={{
                display: 'flex',
                padding: '6px 8px',
                color: 'var(--text-muted)',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                fontSize: '10px',
                textTransform: 'uppercase'
            }}>
                <div style={{ width: '40px' }}>Time</div>
                <div style={{ width: '40px' }}>Side</div>
                <div style={{ flex: 1 }}>Instrument</div>
                <div style={{ width: '50px', textAlign: 'right' }}>Size</div>
                <div style={{ width: '50px', textAlign: 'right' }}>IV</div>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflow: 'auto' }} ref={listRef}>
                {trades.map((trade) => {
                    const isCall = trade.type === 'Call';
                    const isBuy = trade.direction === 'buy';
                    const isBlock = trade.amount * trade.index_price > 50000; // > $50k

                    return (
                        <div key={trade.id} style={{
                            display: 'flex',
                            padding: '4px 8px',
                            borderBottom: '1px solid rgba(255,255,255,0.02)',
                            background: isBlock ? 'rgba(255, 215, 0, 0.05)' : 'transparent',
                            color: isBlock ? '#fff' : 'var(--text-secondary)',
                            fontFamily: 'var(--font-mono)'
                        }}>
                            <div style={{ width: '40px', opacity: 0.7 }}>
                                {new Date(trade.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </div>
                            <div style={{ width: '40px', color: isBuy ? 'var(--accent-primary)' : 'var(--accent-danger)' }}>
                                {isBuy ? 'BUY' : 'SELL'}
                            </div>
                            <div style={{ flex: 1, display: 'flex', gap: '6px' }}>
                                <span style={{ color: '#fff' }}>{getExpiry(trade.instrument)}</span>
                                <span style={{
                                    color: isCall ? 'var(--accent-primary)' : 'var(--accent-danger)',
                                    fontWeight: 'bold'
                                }}>
                                    {getStrike(trade.instrument)} {isCall ? 'C' : 'P'}
                                </span>
                            </div>
                            <div style={{ width: '50px', textAlign: 'right', color: isBlock ? '#ffd700' : 'inherit' }}>
                                {trade.amount.toFixed(1)}
                            </div>
                            <div style={{ width: '50px', textAlign: 'right', opacity: 0.7 }}>
                                {trade.iv.toFixed(1)}%
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default OptionsFlow;
