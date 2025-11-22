import { useState, useEffect } from 'react';

export const useMarketData = (symbol) => {
    const [data, setData] = useState({
        closes: [],
        returns: [],
        metrics: {
            rv: 0,
            zScore: 0,
            regime: 'NEUTRAL',
            price: 0,
            rsi: 50,
            bbWidth: 0,
            vwapDev: 0
        },
        loading: true
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=15m&limit=100`);
                if (!response.ok) throw new Error('Network response was not ok');

                const klines = await response.json();
                if (!klines || klines.length < 50) return; // Not enough data

                const closes = klines.map(k => parseFloat(k[4]));
                const highs = klines.map(k => parseFloat(k[2]));
                const lows = klines.map(k => parseFloat(k[3]));
                const volumes = klines.map(k => parseFloat(k[5]));
                const currentPrice = closes[closes.length - 1];

                // --- CALCULATIONS ---

                // 1. Returns & RV
                const returns = [];
                for (let i = 1; i < closes.length; i++) {
                    returns.push(Math.log(closes[i] / closes[i - 1]));
                }
                const returnsSlice = returns.slice(-50);
                const meanReturn = returnsSlice.reduce((a, b) => a + b, 0) / returnsSlice.length;
                const varReturn = returnsSlice.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / returnsSlice.length;
                const stdReturn = Math.sqrt(varReturn);
                const rv = stdReturn * Math.sqrt(96) * 100;

                // 2. Z-Score (20p)
                const window = 20;
                const slice = closes.slice(-window);
                const mean = slice.reduce((a, b) => a + b, 0) / window;
                const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / window;
                const stdDev = Math.sqrt(variance);
                const zScore = stdDev === 0 ? 0 : (currentPrice - mean) / stdDev;

                // 3. RSI (14p)
                const rsiPeriod = 14;
                let gains = 0;
                let losses = 0;
                // Initial SMA
                for (let i = 1; i <= rsiPeriod; i++) {
                    const diff = closes[i] - closes[i - 1];
                    if (diff >= 0) gains += diff;
                    else losses -= diff;
                }
                let avgGain = gains / rsiPeriod;
                let avgLoss = losses / rsiPeriod;

                // Smooth
                for (let i = rsiPeriod + 1; i < closes.length; i++) {
                    const diff = closes[i] - closes[i - 1];
                    const gain = diff >= 0 ? diff : 0;
                    const loss = diff < 0 ? -diff : 0;
                    avgGain = (avgGain * 13 + gain) / 14;
                    avgLoss = (avgLoss * 13 + loss) / 14;
                }
                const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
                const rsi = 100 - (100 / (1 + rs));

                // 4. Bollinger Bands (20p, 2std)
                // We already have mean (SMA20) and stdDev from Z-Score calc
                const upperBB = mean + (stdDev * 2);
                const lowerBB = mean - (stdDev * 2);
                const bbWidth = (upperBB - lowerBB) / mean; // Normalized width

                // 5. VWAP (Approximation for loaded data)
                let cumVol = 0;
                let cumVolPrice = 0;
                for (let i = 0; i < closes.length; i++) {
                    const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
                    cumVol += volumes[i];
                    cumVolPrice += typicalPrice * volumes[i];
                }
                const vwap = cumVol === 0 ? currentPrice : cumVolPrice / cumVol;
                const vwapDev = ((currentPrice - vwap) / vwap) * 100; // % Deviation

                // Regime
                let regime = 'NEUTRAL';
                if (zScore > 2) regime = 'OVERBOUGHT';
                if (zScore < -2) regime = 'OVERSOLD';
                if (rv > 5) regime = 'HIGH VOL';

                setData({
                    closes,
                    returns,
                    metrics: {
                        rv,
                        zScore,
                        regime,
                        price: currentPrice,
                        rsi,
                        bbWidth,
                        vwapDev
                    },
                    loading: false
                });

            } catch (err) {
                console.error("Market Data Fetch Error", err);
                // Keep old data if fetch fails, or set loading false to show stale state
                setData(prev => ({ ...prev, loading: false }));
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, [symbol]);

    return data;
};
