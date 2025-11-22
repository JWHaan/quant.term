import React, { useState, useEffect } from 'react';
import { multiAssetWS } from '../services/multiAssetWebSocket';

const ASSETS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'MATIC'];

/**
 * Real-Time Correlation Matrix
 * Calculates Pearson correlation coefficient on live price updates
 * Uses a rolling window of the last 50 price points
 */
const CorrelationMatrix = () => {
    const [history, setHistory] = useState({}); // { symbol: [price1, price2, ...] }
    const [correlations, setCorrelations] = useState({});

    // Subscribe to assets
    useEffect(() => {
        const symbols = ASSETS.map(a => `${a}USDT`);

        const handleUpdate = ({ symbol, data }) => {
            setHistory(prev => {
                const sym = symbol.replace('USDT', '');
                const currentHistory = prev[sym] || [];
                const newHistory = [...currentHistory, parseFloat(data.price)].slice(-50); // Keep last 50 points
                return { ...prev, [sym]: newHistory };
            });
        };

        multiAssetWS.subscribe(symbols, handleUpdate);
        return () => multiAssetWS.unsubscribe(symbols, handleUpdate);
    }, []);

    // Calculate Correlations (Throttled to 1s)
    useEffect(() => {
        const interval = setInterval(() => {
            const assets = Object.keys(history);
            const matrix = {};

            for (let i = 0; i < assets.length; i++) {
                for (let j = 0; j < assets.length; j++) {
                    const a1 = assets[i];
                    const a2 = assets[j];
                    const key = `${a1}-${a2}`;

                    if (a1 === a2) {
                        matrix[key] = 1;
                        continue;
                    }

                    const h1 = history[a1];
                    const h2 = history[a2];

                    // Need overlapping history length
                    const len = Math.min(h1.length, h2.length);
                    if (len < 10) {
                        matrix[key] = 0;
                        continue;
                    }

                    // Pearson Correlation
                    const s1 = h1.slice(-len);
                    const s2 = h2.slice(-len);

                    const mean1 = s1.reduce((a, b) => a + b, 0) / len;
                    const mean2 = s2.reduce((a, b) => a + b, 0) / len;

                    let num = 0;
                    let den1 = 0;
                    let den2 = 0;

                    for (let k = 0; k < len; k++) {
                        const d1 = s1[k] - mean1;
                        const d2 = s2[k] - mean2;
                        num += d1 * d2;
                        den1 += d1 * d1;
                        den2 += d2 * d2;
                    }

                    const corr = den1 && den2 ? num / Math.sqrt(den1 * den2) : 0;
                    matrix[key] = corr;
                }
            }
            setCorrelations(matrix);
        }, 1000);

        return () => clearInterval(interval);
    }, [history]);

    const getColor = (val) => {
        if (val >= 0.8) return 'rgba(0, 255, 157, 0.8)'; // Strong Positive
        if (val >= 0.5) return 'rgba(0, 255, 157, 0.4)'; // Moderate Positive
        if (val <= -0.8) return 'rgba(255, 0, 85, 0.8)'; // Strong Negative
        if (val <= -0.5) return 'rgba(255, 0, 85, 0.4)'; // Moderate Negative
        return 'rgba(255, 255, 255, 0.05)'; // Neutral
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#000', padding: '8px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: `30px repeat(${ASSETS.length}, 1fr)`, gap: '2px' }}>
                {/* Header Row */}
                <div />
                {ASSETS.map(asset => (
                    <div key={asset} style={{ fontSize: '10px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        {asset}
                    </div>
                ))}

                {/* Rows */}
                {ASSETS.map(rowAsset => (
                    <React.Fragment key={rowAsset}>
                        {/* Row Label */}
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                            {rowAsset}
                        </div>

                        {/* Cells */}
                        {ASSETS.map(colAsset => {
                            const val = correlations[`${rowAsset}-${colAsset}`] || 0;
                            return (
                                <div
                                    key={`${rowAsset}-${colAsset}`}
                                    style={{
                                        aspectRatio: '1',
                                        background: getColor(val),
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '9px',
                                        color: Math.abs(val) > 0.5 ? '#000' : 'var(--text-secondary)',
                                        borderRadius: '2px'
                                    }}
                                    title={`${rowAsset} vs ${colAsset}: ${val.toFixed(2)}`}
                                >
                                    {val === 1 ? '' : val.toFixed(1)}
                                </div>
                            );
                        })}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};

export default CorrelationMatrix;
