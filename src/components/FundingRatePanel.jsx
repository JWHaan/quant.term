import React, { useEffect, useState } from 'react';
import { futuresWS } from '@/services/binanceFutures';
import { useMarketStore } from '@/stores/marketStore';
import { TrendingUp, TrendingDown, Clock, DollarSign } from 'lucide-react';

/**
 * Funding Rate Panel (Real-Time)
 * Displays live funding rates and countdown from Binance Futures.
 * 
 * Stream: <symbol>@markPrice
 * Data:
 * - r: Funding Rate
 * - T: Next Funding Time
 * - p: Mark Price
 * - i: Index Price
 */
const FundingRatePanel = ({ symbol = 'BTCUSDT' }) => {
    const [data, setData] = useState({
        fundingRate: 0,
        nextFundingTime: 0,
        markPrice: 0,
        indexPrice: 0
    });
    const [countdown, setCountdown] = useState('');

    useEffect(() => {
        const streamName = `${symbol.toLowerCase()}@markPrice`;

        const handleUpdate = (msg) => {
            // Data structure:
            // e: "markPriceUpdate"
            // E: 1562305380000
            // s: "BTCUSDT"
            // p: "11794.15000000" // Mark Price
            // i: "11784.62659091" // Index Price
            // P: "11784.25641265" // Estimated Settle Price
            // r: "0.00038167"     // Funding Rate
            // T: 1562306400000    // Next Funding Time

            setData({
                fundingRate: parseFloat(msg.r),
                nextFundingTime: msg.T,
                markPrice: parseFloat(msg.p),
                indexPrice: parseFloat(msg.i)
            });
        };

        futuresWS.subscribe(streamName, handleUpdate);

        return () => {
            futuresWS.unsubscribe(streamName, handleUpdate);
        };
    }, [symbol]);

    // Countdown timer
    useEffect(() => {
        if (!data.nextFundingTime) return;

        const timer = setInterval(() => {
            const now = Date.now();
            const diff = data.nextFundingTime - now;

            if (diff <= 0) {
                setCountdown('00:00:00');
                return;
            }

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            setCountdown(
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
            );
        }, 1000);

        return () => clearInterval(timer);
    }, [data.nextFundingTime]);

    // Annualized rate calculation (Funding * 3 * 365)
    const annualizedRate = (data.fundingRate * 3 * 365 * 100).toFixed(2);
    const isPositive = data.fundingRate > 0;

    return (
        <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: '#000',
            padding: '8px',
            gap: '12px',
            fontFamily: 'var(--font-mono)'
        }}>
            {/* Main Rate Display */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px',
                background: isPositive ? 'rgba(0,255,157,0.05)' : 'rgba(255,0,85,0.05)',
                border: `1px solid ${isPositive ? 'rgba(0,255,157,0.2)' : 'rgba(255,0,85,0.2)'}`,
                borderRadius: '4px'
            }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Current Funding Rate
                </span>
                <div style={{
                    fontSize: '24px',
                    fontWeight: 'bold',
                    color: isPositive ? 'var(--accent-primary)' : 'var(--accent-danger)',
                    marginTop: '4px'
                }}>
                    {(data.fundingRate * 100).toFixed(4)}%
                </div>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    APR: {annualizedRate}%
                </span>
            </div>

            {/* Countdown */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '4px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={14} color="var(--text-muted)" />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Next Funding</span>
                </div>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>
                    {countdown || '--:--:--'}
                </span>
            </div>

            {/* Price Basis */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                marginTop: 'auto'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Mark Price</span>
                    <span style={{ color: '#fff' }}>${data.markPrice.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Index Price</span>
                    <span style={{ color: '#fff' }}>${data.indexPrice.toFixed(2)}</span>
                </div>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    paddingTop: '4px',
                    borderTop: '1px solid rgba(255,255,255,0.1)'
                }}>
                    <span style={{ color: 'var(--text-muted)' }}>Premium</span>
                    <span style={{ color: data.markPrice >= data.indexPrice ? 'var(--accent-primary)' : 'var(--accent-danger)' }}>
                        {(data.markPrice - data.indexPrice).toFixed(2)}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default FundingRatePanel;
