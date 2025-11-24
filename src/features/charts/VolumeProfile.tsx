import React, { useMemo } from 'react';

/**
 * Volume Profile - Shows price levels with highest trading activity
 * Helps identify support/resistance and value areas
 */
interface Candle {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

interface VolumeProfileProps {
    candles?: Candle[];
}

export const VolumeProfile: React.FC<VolumeProfileProps> = ({ candles = [] }) => {
    const profile = useMemo(() => {
        if (!candles || candles.length === 0) return { bins: [], poc: 0, valueAreaHigh: 0, valueAreaLow: 0, maxVolume: 0 };

        // Get price range
        const prices = candles.flatMap(c => [c.high, c.low]);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);

        // Create 30 price bins
        const numBins = 30;
        const binSize = (maxPrice - minPrice) / numBins;
        const bins = Array(numBins).fill(0).map((_, i) => ({
            price: minPrice + (i + 0.5) * binSize,
            volume: 0,
            buyVolume: 0,
            sellVolume: 0
        }));

        // Accumulate volume in bins
        candles.forEach(candle => {
            const binIndex = Math.min(
                numBins - 1,
                Math.floor((candle.close - minPrice) / binSize)
            );

            if (binIndex >= 0 && binIndex < numBins && bins[binIndex]) {
                const bin = bins[binIndex];
                bin.volume += candle.volume;

                // Estimate buy/sell volume based on close vs open
                const isBullish = candle.close > candle.open;
                if (isBullish) {
                    bin.buyVolume += candle.volume * 0.65;
                    bin.sellVolume += candle.volume * 0.35;
                } else {
                    bin.buyVolume += candle.volume * 0.35;
                    bin.sellVolume += candle.volume * 0.65;
                }
            }
        });

        // Find Point of Control (highest volume)
        const poc = bins.reduce((max, bin) => bin.volume > max.volume ? bin : max, bins[0] || { volume: 0, price: 0 });

        // Find Value Area (70% of volume)
        const totalVolume = bins.reduce((sum, bin) => sum + bin.volume, 0);
        const targetVolume = totalVolume * 0.7;

        const sortedBins = [...bins].sort((a, b) => b.volume - a.volume);
        let cumVolume = 0;
        const valueAreaPrices = [];

        for (const bin of sortedBins) {
            cumVolume += bin.volume;
            valueAreaPrices.push(bin.price);
            if (cumVolume >= targetVolume) break;
        }

        return {
            bins,
            poc: poc.price,
            valueAreaHigh: Math.max(...valueAreaPrices),
            valueAreaLow: Math.min(...valueAreaPrices),
            maxVolume: Math.max(...bins.map(b => b.volume)) || 0
        };
    }, [candles]);

    if (!candles || candles.length === 0) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading volume data...
            </div>
        );
    }

    const { bins, poc, valueAreaHigh, valueAreaLow, maxVolume } = profile;

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '12px' }}>
            {/* Stats */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
                marginBottom: '12px',
                fontSize: '11px'
            }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '4px' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '9px' }}>POC (Point of Control)</div>
                    <div style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)', fontWeight: '600' }}>
                        ${poc.toFixed(2)}
                    </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '4px' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '9px' }}>Value Area High</div>
                    <div style={{ color: '#fff', fontFamily: 'var(--font-mono)', fontWeight: '600' }}>
                        ${valueAreaHigh.toFixed(2)}
                    </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '4px' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '9px' }}>Value Area Low</div>
                    <div style={{ color: '#fff', fontFamily: 'var(--font-mono)', fontWeight: '600' }}>
                        ${valueAreaLow.toFixed(2)}
                    </div>
                </div>
            </div>

            {/* Volume bars */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column-reverse', gap: '1px', overflow: 'auto' }}>
                {bins.map((bin, i) => {
                    const widthPercent = maxVolume > 0 ? (bin.volume / maxVolume) * 100 : 0;
                    const isInValueArea = bin.price >= valueAreaLow && bin.price <= valueAreaHigh;
                    const isPOC = Math.abs(bin.price - poc) < 0.01;
                    const buyPercent = bin.volume > 0 ? (bin.buyVolume / bin.volume) * 100 : 50;

                    return (
                        <div
                            key={i}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                height: '100%',
                                minHeight: '14px'
                            }}
                        >
                            {/* Price label */}
                            <div style={{
                                width: '60px',
                                fontSize: '10px',
                                fontFamily: 'var(--font-mono)',
                                color: isPOC ? 'var(--accent-primary)' : 'var(--text-muted)',
                                fontWeight: isPOC ? '600' : '400',
                                textAlign: 'right'
                            }}>
                                {bin.price.toFixed(2)}
                            </div>

                            {/* Volume bar */}
                            <div style={{ flex: 1, position: 'relative', height: '100%' }}>
                                {/* Background */}
                                <div style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: 0,
                                    bottom: 0,
                                    width: `${widthPercent}%`,
                                    background: isInValueArea
                                        ? 'linear-gradient(90deg, rgba(0,255,157,0.2) 0%, rgba(0,255,157,0.05) 100%)'
                                        : 'rgba(255,255,255,0.05)',
                                    border: isPOC ? '1px solid var(--accent-primary)' : 'none',
                                    borderRadius: '2px'
                                }} />

                                {/* Buy/Sell split */}
                                <div style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: 0,
                                    bottom: 0,
                                    width: `${(widthPercent * buyPercent) / 100}%`,
                                    background: 'linear-gradient(90deg, rgba(0,255,157,0.4) 0%, rgba(0,255,157,0.1) 100%)',
                                    borderRadius: '2px 0 0 2px'
                                }} />
                            </div>

                            {/* Volume value */}
                            <div style={{
                                width: '50px',
                                fontSize: '9px',
                                fontFamily: 'var(--font-mono)',
                                color: 'var(--text-muted)',
                                textAlign: 'right'
                            }}>
                                {bin.volume > 1000 ? `${(bin.volume / 1000).toFixed(1)}K` : bin.volume.toFixed(0)}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Legend */}
            <div style={{
                marginTop: '8px',
                fontSize: '9px',
                color: 'var(--text-muted)',
                display: 'flex',
                gap: '12px',
                justifyContent: 'center'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '12px', height: '8px', background: 'rgba(0,255,157,0.4)', borderRadius: '2px' }} />
                    Buy Pressure
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '12px', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }} />
                    Sell Pressure
                </div>
            </div>
        </div>
    );
};

export default VolumeProfile;
